import { NextResponse } from "next/server";
import {
  documentPublicIdFromUrl,
  downloadDocumentFromCloudinary,
} from "@/lib/documents-cms/cloudinary";

/**
 * Public download proxy for Cloudinary-hosted About Us documents.
 * Cloudinary often blocks unsigned PDF/ZIP CDN delivery; this streams via Admin API.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const urlParam = searchParams.get("url");
    const publicIdParam = searchParams.get("publicId");

    const publicId = publicIdParam?.trim()
      ? publicIdParam.trim()
      : urlParam
        ? documentPublicIdFromUrl(urlParam)
        : null;

    if (!publicId || !publicId.startsWith("asosc/docs/")) {
      return NextResponse.json({ error: "Invalid document" }, { status: 400 });
    }

    const { buffer, contentType } =
      await downloadDocumentFromCloudinary(publicId);
    const filename = publicId.split("/").pop() || "document";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Download failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
