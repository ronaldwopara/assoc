export const GALLERY_BOTTOM_HASH = "#gallery-bottom";
export const GALLERY_BOTTOM_HREF = `/${GALLERY_BOTTOM_HASH}`;

export function scrollGalleryToBottom(behavior: ScrollBehavior = "smooth") {
  const gallery = document.getElementById("gallery");

  if (!gallery) return false;

  gallery.scrollIntoView({ behavior, block: "end" });
  return true;
}
