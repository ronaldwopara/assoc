import type { MetadataRoute } from "next";

/** Lets staff add the dashboard to their home screen (needed for notifications on iPhone). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ASOSC Dashboard",
    short_name: "ASOSC",
    start_url: "/upgrade?tool=dashboard",
    display: "standalone",
    background_color: "#faf5eb",
    theme_color: "#2f2b28",
    icons: [
      { src: "https://res.cloudinary.com/daldas2e7/image/upload/f_png,w_192,h_192,c_pad,b_rgb:faf5eb/v1782010314/asosc/logo.webp", sizes: "192x192", type: "image/png" },
      { src: "https://res.cloudinary.com/daldas2e7/image/upload/f_png,w_512,h_512,c_pad,b_rgb:faf5eb/v1782010314/asosc/logo.webp", sizes: "512x512", type: "image/png" },
    ],
  };
}
