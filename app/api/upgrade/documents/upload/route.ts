import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { uploadDocumentToCloudinary } from "@/lib/documents-cms/cloudinary";
import {
  contentTypeFromFilename,
  validateDocumentFile,
} from "@/lib/documents-cms/validate";

export async function POST(request: Request) {
  if (!(await isUpgradeAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const groupIdRaw = form.get("groupId");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing document file" }, { status: 400 });
    }

    const validationError = validateDocumentFile(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const groupId =
      typeof groupIdRaw === "string" && groupIdRaw.trim()
        ? groupIdRaw.trim().replace(/[^a-zA-Z0-9_-]/g, "")
        : "general";
    if (!groupId) {
      return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
    }

    const filename = file.name || "document.pdf";
    const publicId = `doc-${Date.now()}`;
    const uploaded = await uploadDocumentToCloudinary({
      file,
      filename,
      groupId,
      publicId,
    });

    return NextResponse.json({
      url: uploaded.secureUrl,
      filename,
      contentType: contentTypeFromFilename(filename),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
