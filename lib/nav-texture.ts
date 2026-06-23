/** Self-hosted navbar / loading-screen repeat texture (see public/nav.webp). */
export const NAV_TEXTURE_URL = "/nav.webp";

export const NAV_TEXTURE_OPACITY = 0.95;

export const navTextureBackgroundStyle = {
  backgroundImage: `url(${NAV_TEXTURE_URL})`,
  backgroundRepeat: "repeat" as const,
  opacity: NAV_TEXTURE_OPACITY,
} as const;

/** Loading screen: brown underlay + repeating nav texture (inline — not CSS-gated). */
export const loadingScreenBackgroundStyle = {
  ...navTextureBackgroundStyle,
  backgroundColor: "rgb(10, 8, 6)",
} as const;
