import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { deletePopupImageUrls } from "@/lib/popup-cms/cloudinary";

/** Delete popup flyer assets from Cloudinary (draft orphans / explicit cleanup). */
export async function POST(request: Request) {
  if (!(await isUpgradeAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { urls?: unknown };
    const urls = Array.isArray(body.urls)
      ? body.urls.filter((url): url is string => typeof url === "string" && url.length > 0)
      : [];
    if (urls.length === 0) {
      return NextResponse.json({ error: "No image URLs provided" }, { status: 400 });
    }

    const result = await deletePopupImageUrls(urls);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete images";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
