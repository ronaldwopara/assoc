import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { uploadImageToCloudinary } from "@/lib/gallery-cms/cloudinary";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing image file" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 });
    }

    const publicId = `membership-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const uploaded = await uploadImageToCloudinary({
      file,
      filename: `${publicId}.png`,
      folder: "asosc/membership-cards",
      publicId,
    });

    return NextResponse.json({ url: uploaded.secureUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
