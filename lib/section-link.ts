import { GALLERY_BOTTOM_HASH, scrollGalleryToBottom } from "@/lib/gallery-scroll";

/** Scrolls to the section matching a "#id" hash, smoothly. Handles the gallery's special bottom-scroll case. */
export function scrollToHash(hash: string, behavior: ScrollBehavior = "smooth") {
  if (hash === GALLERY_BOTTOM_HASH) {
    scrollGalleryToBottom(behavior);
    return;
  }
  const id = hash.slice(1);
  document.getElementById(id)?.scrollIntoView({ behavior });
}

/**
 * Next.js `Link` no-ops when the destination matches the current URL, so clicking a section
 * link while already on that section (or already on the home page) does nothing. This forces
 * the scroll to happen on every click when already on the home page.
 */
export function handleSectionLinkClick(
  event: { preventDefault: () => void },
  href: string,
  isHome: boolean,
) {
  const hashIndex = href.indexOf("#");
  if (!isHome || hashIndex < 0) return;

  const hash = href.slice(hashIndex);
  event.preventDefault();
  window.history.pushState(null, "", href);
  scrollToHash(hash);
}
