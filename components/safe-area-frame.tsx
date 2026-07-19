/**
 * Fixed color strips covering the top (notch/status-bar) and bottom
 * (home-indicator) safe-area insets.
 *
 * These are real DOM elements — not body::before/::after pseudo-elements —
 * and each is promoted to its own compositing layer (translate3d). iOS
 * Safari otherwise fails to paint fixed elements into the safe-area region
 * on first frame, leaving stale color (e.g. the dark loading screen) behind
 * the status bar until a scroll/overscroll forces a repaint.
 *
 * Must stay outside any filter/blur tree (Join Community blurs other body
 * children, never these). Top matches --page-chrome; bottom stays black.
 * The loading screen is also inset from the top so html/body chrome shows
 * in the notch even before these strips composite.
 */
export function SafeAreaFrame() {
  return (
    <>
      <div className="safe-area-strip safe-area-strip--top" aria-hidden="true" />
      <div className="safe-area-strip safe-area-strip--bottom" aria-hidden="true" />
    </>
  );
}
