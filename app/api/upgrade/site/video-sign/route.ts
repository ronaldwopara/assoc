import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { SITE_MEDIA_FOLDER } from "@/lib/site-content";

/**
 * Signs a direct browser → Cloudinary video upload, so big clips never pass
 * through our server (Vercel caps request bodies at ~4.5 MB).
 */
export async function POST() {
  if (!(await isUpgradeAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return NextResponse.json({ error: "Uploads aren't set up" }, { status: 500 });
  const timestamp = Math.round(Date.now() / 1000);
  const folder = `${SITE_MEDIA_FOLDER}/videos`;
  const signature = createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest("hex");
  return NextResponse.json({ url: `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, apiKey, timestamp, folder, signature });
}
