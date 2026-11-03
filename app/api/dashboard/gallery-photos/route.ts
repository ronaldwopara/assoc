import { NextResponse } from "next/server";
import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { getGalleryCmsData } from "@/lib/gallery-cms";

/** Photos from the website's gallery, grouped by event and year, for the email photo picker. */
export async function GET() {
  if (!(await isUpgradeAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const data = await getGalleryCmsData();
    const albums = data.programs.flatMap((program) =>
      program.years
        .filter((y) => y.images.length > 0)
        .map((y) => ({
          title: `${program.title} ${y.year}`.trim(),
          photos: y.images.map((img) => img.src),
        })),
    );
    return NextResponse.json({ albums });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn't load the gallery" }, { status: 500 });
  }
}
