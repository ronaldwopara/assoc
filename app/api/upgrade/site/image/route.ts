import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { uploadImageToCloudinary } from "@/lib/gallery-cms/cloudinary";
import { SITE_MEDIA_FOLDER } from "@/lib/site-content";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

/** A picture for any site section. It only goes live when the section is saved. */
export async function POST(request: Request) {
  if (!(await isUpgradeAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Missing picture" }, { status: 400 });
    if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: "Picture must be under 12MB" }, { status: 400 });
    if (file.type && !ALLOWED.has(file.type)) return NextResponse.json({ error: "Use a PNG, JPEG or WebP picture" }, { status: 400 });
    const publicId = `img-${Date.now()}`;
    const uploaded = await uploadImageToCloudinary({ file, filename: file.name || `${publicId}.jpg`, folder: SITE_MEDIA_FOLDER, publicId });
    return NextResponse.json({ url: uploaded.secureUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 });
  }
}
