import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { uploadImageToCloudinary } from "@/lib/gallery-cms/cloudinary";
import { slugifyProgramTitle } from "@/lib/gallery-cms/slug";

export async function POST(request: Request) {
  if (!(await isUpgradeAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const programSlugRaw = form.get("programSlug");
    const yearRaw = form.get("year");
    const slotRaw = form.get("slot");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing image file" }, { status: 400 });
    }
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "Image must be under 12MB" }, { status: 400 });
    }

    const programSlug =
      typeof programSlugRaw === "string" && programSlugRaw.trim()
        ? slugifyProgramTitle(programSlugRaw)
        : "gallery";
    const year =
      typeof yearRaw === "string" && yearRaw.trim() ? yearRaw.trim() : "year";
    const slot = Number(slotRaw);
    if (!Number.isInteger(slot) || slot < 0 || slot > 5) {
      return NextResponse.json({ error: "Invalid image slot" }, { status: 400 });
    }

    const publicId = `${programSlug}-${year}-${slot + 1}-${Date.now()}`;
    const uploaded = await uploadImageToCloudinary({
      file,
      filename: file.name || `${publicId}.jpg`,
      folder: `asosc/gallery-prev/${programSlug}`,
      publicId,
    });

    return NextResponse.json({
      src: uploaded.secureUrl,
      ratio: uploaded.width / Math.max(uploaded.height, 1),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
