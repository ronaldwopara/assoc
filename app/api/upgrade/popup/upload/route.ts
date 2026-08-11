import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { uploadImageToCloudinary } from "@/lib/gallery-cms/cloudinary";
import { POPUP_IMAGE_FOLDER } from "@/lib/popup-cms/cloudinary";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function POST(request: Request) {
  if (!(await isUpgradeAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing flyer image" }, { status: 400 });
    }
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "Image must be under 12MB" }, { status: 400 });
    }
    if (file.type && !ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Only PNG, JPEG, and WebP flyers are allowed" },
        { status: 400 },
      );
    }

    const publicId = `flyer-${Date.now()}`;
    const uploaded = await uploadImageToCloudinary({
      file,
      filename: file.name || `${publicId}.jpg`,
      folder: POPUP_IMAGE_FOLDER,
      publicId,
    });

    return NextResponse.json({
      imageUrl: uploaded.secureUrl,
      imageRatio: uploaded.width / Math.max(uploaded.height, 1),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
