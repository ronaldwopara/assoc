/**
 * ASOSC dashboard — React hooks
 * =================================================================
 * Drop-in data layer. No UI opinions in here.
 *
 *   const { rows, loading, error, refresh } = useSheetTab('transactions');
 *   const { approve, pending } = useApproval('transactions', refresh);
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchRows, fetchHealth, approveRow,
  setIdToken, isSignedIn, getIdentity, signOut,
  needsReview, STATUS, FIELD,
} from '../lib/asoscClient';

// ============================================================ SIGN-IN

/**
 * Google Identity Services. Loads the script once, renders the button
 * into whatever element you hand back the ref to.
 *
 *   const { ready, identity, buttonRef, logout } = useGoogleSignIn(CLIENT_ID);
 *   return <div ref={buttonRef} />;
 */
export function useGoogleSignIn(clientId) {
  const [ready, setReady] = useState(false);
  const [identity, setIdentity] = useState(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!clientId) return;

    const init = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp) => {
          setIdToken(resp.credential);
          setIdentity(getIdentity());
        },
        auto_select: true,
        cancel_on_tap_outside: false,
      });
      if (buttonRef.current) {
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline', size: 'large', text: 'signin_with',
        });
      }
      window.google.accounts.id.prompt();
      setReady(true);
    };

    if (window.google?.accounts?.id) { init(); return; }

    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = init;
    document.head.appendChild(s);
  }, [clientId]);

  // ID tokens last about an hour. Re-prompt before expiry so a long
  // review session doesn't die mid-click with AS-10.
  useEffect(() => {
    if (!identity?.expiresAt) return;
    const ms = identity.expiresAt - Date.now() - 5 * 60 * 1000;
    if (ms <= 0) return;
    const t = setTimeout(() => window.google?.accounts?.id?.prompt(), ms);
    return () => clearTimeout(t);
  }, [identity]);

  const logout = useCallback(() => { signOut(); setIdentity(null); }, []);

  return { ready, identity, signedIn: isSignedIn(), buttonRef, logout };
}

// ============================================================ READS

/**
 * Poll interval is deliberately slow. Apps Script only appends every
 * 30 minutes, so a 15-second dashboard poll would burn Sheets quota
 * to show you the same rows 120 times between writes.
 */
export function useSheetTab(tab = 'transactions', { pollMs = 120000, enabled = true } = {}) {
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [readAt, setReadAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const load = useCallback(async (force = false) => {
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    try {
      const data = await fetchRows(tab, { force, signal: ctl.signal });
      setRows(data.rows);
      setHeaders(data.headers);
      setReadAt(data.readAt);
      setError(null);
    } catch (e) {
      if (e.name !== 'AbortError') setError({ code: e.code, message: e.message });
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    if (!enabled) return;
    load();
    if (!pollMs) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, pollMs);
    return () => { clearInterval(id); abortRef.current?.abort(); };
  }, [enabled, load, pollMs]);

  return {
    rows, headers, readAt, loading, error,
    review: needsReview(rows),
    refresh: () => load(true),
  };
}

export function useHealth({ pollMs = 300000 } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => fetchHealth()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError({ code: e.code, message: e.message }));
    load();
    const id = setInterval(load, pollMs);
    return () => { alive = false; clearInterval(id); };
  }, [pollMs]);

  return { health: data, error };
}

// ============================================================ WRITES

/**
 * Optimistic approval with rollback.
 *
 * Busayo's approval means "I saw proof of payment" — including a cash
 * payment that never generated an email at all. So this is her
 * judgement being recorded, not a parser result being confirmed, and
 * it has to feel instant. We paint the row immediately and undo it if
 * the server disagrees.
 *
 * AS-14 is the interesting failure: it means the row changed under
 * her. Surface it as "refresh and look again", never as a retry loop.
 */
export function useApproval(tab, onSettled) {
  const [pending, setPending] = useState({});   // key -> true
  const [error, setError] = useState(null);

  const approve = useCallback(async (row, status, notes) => {
    const key = row[tab === 'members' ? 'Entry ID' : FIELD.messageId];
    if (!key) {
      setError({ code: 'AS-13', message: 'This row has no ID. Try refreshing your sheet.' });
      return false;
    }

    setPending((p) => ({ ...p, [key]: true }));
    setError(null);
    try {
      await approveRow({ tab, key, status, notes, expect: row[FIELD.status] || '' });
      onSettled?.();
      return true;
    } catch (e) {
      setError({ code: e.code, message: e.message, stale: e.code === 'AS-14' });
      if (e.code === 'AS-14') onSettled?.();
      return false;
    } finally {
      setPending((p) => { const n = { ...p }; delete n[key]; return n; });
    }
  }, [tab, onSettled]);

  return {
    approve,
    approving: (row) => Boolean(pending[row?.[FIELD.messageId]]),
    error,
    clearError: () => setError(null),
    STATUS,
  };
}
