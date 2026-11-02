import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { uploadImageToCloudinary } from "@/lib/gallery-cms/cloudinary";
import { uploadDocumentToCloudinary } from "@/lib/documents-cms/cloudinary";

export const maxDuration = 60;

// Vercel caps request bodies at ~4.5MB.
const MAX_BYTES = 4 * 1024 * 1024;

/** Upload an event image (kind=image) or an attachment (kind=attachment). */
export async function POST(request: Request) {
  try {
    if (!(await isUpgradeAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const form = await request.formData();
    const file = form.get("file");
    const kind = form.get("kind") === "attachment" ? "attachment" : "image";
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Files must be under 4MB" }, { status: 400 });

    const id = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    if (kind === "image") {
      if (!/^image\/(jpeg|png|webp|gif|heic|heif)$/.test(file.type)) {
        return NextResponse.json({ error: "Images must be JPG, PNG, WebP, GIF or HEIC" }, { status: 400 });
      }
      const uploaded = await uploadImageToCloudinary({ file, filename: `${id}.png`, folder: "asosc/email/events", publicId: `event-${id}` });
      return NextResponse.json({ url: uploaded.secureUrl });
    }

    const safeName = file.name.replace(/[^\w.\- ()]+/g, "_").slice(0, 120) || "attachment";
    const ext = safeName.includes(".") ? safeName.slice(safeName.lastIndexOf(".")) : "";
    const uploaded = await uploadDocumentToCloudinary({ file, filename: safeName, groupId: "email-attachments", publicId: `${id}${ext}` });
    return NextResponse.json({ attachment: { name: safeName, url: uploaded.secureUrl, size: file.size, type: file.type || "application/octet-stream" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
