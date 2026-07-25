/** Self-hosted navbar repeat texture (see public/nav.webp). */
export const NAV_TEXTURE_URL = "/nav.webp";

const NAV_TEXTURE_TILE_SIZE = 1254;

export function navTextureBackgroundStyleFromCssVar(opacity = 1) {
  return {
    backgroundImage: "var(--nav-texture-url)",
    backgroundRepeat: "repeat" as const,
    backgroundSize: `${NAV_TEXTURE_TILE_SIZE}px ${NAV_TEXTURE_TILE_SIZE}px` as const,
    opacity,
  } as const;
}
