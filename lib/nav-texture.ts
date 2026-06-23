/** Self-hosted navbar / loading-screen repeat texture (see public/nav.webp). */
export const NAV_TEXTURE_URL = "/nav.webp";

export const NAV_TEXTURE_TILE_SIZE = 1254;

export const NAV_TEXTURE_OPACITY = 1;

export const navTextureCssVar = "var(--nav-texture-url)";

const navTextureTileBackgroundSize = `${NAV_TEXTURE_TILE_SIZE}px ${NAV_TEXTURE_TILE_SIZE}px` as const;

export function navTextureBackgroundStyleFromCssVar(opacity = NAV_TEXTURE_OPACITY) {
  return {
    backgroundImage: navTextureCssVar,
    backgroundRepeat: "repeat" as const,
    backgroundSize: navTextureTileBackgroundSize,
    opacity,
  } as const;
}
