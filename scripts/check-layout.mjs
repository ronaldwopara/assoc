import { chromium } from "playwright";

const browser = await chromium.launch();
for (const width of [768, 1280, 1920]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  const data = await page.evaluate(() => {
    const programs = document.querySelector("#programs");
    const about = document.querySelector("#about");
    const frame = document.querySelector(".programs-bento-frame");
    const grid = document.querySelector(".programs-bento-grid");
    const pr = programs.getBoundingClientRect();
    const ar = about.getBoundingClientRect();
    const fr = frame.getBoundingClientRect();
    const gr = grid.getBoundingClientRect();
    return {
      programsBottom: pr.bottom,
      aboutTop: ar.top,
      gap: ar.top - pr.bottom,
      frameBottom: fr.bottom,
      gridBottom: gr.bottom,
      gridOverflow: gr.bottom - fr.bottom,
      programsContainsGrid: pr.bottom >= gr.bottom - 1,
    };
  });
  console.log("viewport", width, JSON.stringify(data, null, 2));
  await page.close();
}
await browser.close();
