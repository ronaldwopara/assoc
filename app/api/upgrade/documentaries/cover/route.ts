import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { uploadImageToCloudinary } from "@/lib/gallery-cms/cloudinary";
import { DOCUMENTARY_COVER_FOLDER } from "@/lib/documentaries";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

/** Uploads a cover picture. It only goes live when the documentary list is saved. */
export async function POST(request: Request) {
  if (!(await isUpgradeAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Missing picture" }, { status: 400 });
    if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: "Picture must be under 12MB" }, { status: 400 });
    if (file.type && !ALLOWED.has(file.type)) {
      return NextResponse.json({ error: "Use a PNG, JPEG or WebP picture" }, { status: 400 });
    }
    const publicId = `cover-${Date.now()}`;
    const uploaded = await uploadImageToCloudinary({
      file,
      filename: file.name || `${publicId}.jpg`,
      folder: DOCUMENTARY_COVER_FOLDER,
      publicId,
    });
    return NextResponse.json({ url: uploaded.secureUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 });
  }
}
