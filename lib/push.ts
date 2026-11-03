/**
 * Push notifications to staff devices when a form comes in.
 *
 * Each device that turns notifications on (from the dashboard's Form log page)
 * is saved in the master sheet's Settings tab. Needs two Vercel env vars,
 * VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (generate with `npx web-push generate-vapid-keys`).
 */

import webpush, { type PushSubscription } from "web-push";
import { getSetting, setSetting } from "@/lib/settings";

const KEY = "pushSubscriptions";

type Saved = PushSubscription & { device?: string; added: string };

export function pushKeys(): { publicKey: string; privateKey: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  return publicKey && privateKey ? { publicKey, privateKey } : null;
}

async function load(): Promise<Saved[]> {
  try {
    const parsed = JSON.parse((await getSetting(KEY)) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addSubscription(sub: PushSubscription, device: string): Promise<number> {
  if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) {
    throw new Error("That device didn't give a usable subscription");
  }
  const all = (await load()).filter((s) => s.endpoint !== sub.endpoint);
  all.push({ endpoint: sub.endpoint, keys: sub.keys, device: device.slice(0, 120), added: new Date().toISOString() });
  await setSetting(KEY, JSON.stringify(all));
  return all.length;
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await setSetting(KEY, JSON.stringify((await load()).filter((s) => s.endpoint !== endpoint)));
}

export type PushMessage = { title: string; body: string; url?: string; tag?: string };

/** Sends to every saved device (or just one). Devices that are gone are forgotten. Never throws. */
export async function notify(message: PushMessage, onlyEndpoint?: string): Promise<{ sent: number; failed: number }> {
  const keys = pushKeys();
  if (!keys) return { sent: 0, failed: 0 };
  webpush.setVapidDetails("mailto:support@asosc.ca", keys.publicKey, keys.privateKey);
  const subs = (await load()).filter((s) => !onlyEndpoint || s.endpoint === onlyEndpoint);
  const gone: string[] = [];
  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s, JSON.stringify(message), { TTL: 60 * 60 * 24 });
        sent += 1;
      } catch (error) {
        failed += 1;
        const code = (error as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.endpoint);
      }
    }),
  );
  if (gone.length) await setSetting(KEY, JSON.stringify((await load()).filter((s) => !gone.includes(s.endpoint)))).catch(() => undefined);
  return { sent, failed };
}
