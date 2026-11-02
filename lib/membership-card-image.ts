import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { MembershipCard, type MembershipCardProps } from "@/components/membership-card";

/** Renders MembershipCard off-screen and captures it as a PNG blob, independent of any mounted UI. */
export async function renderMembershipCardPng(props: MembershipCardProps): Promise<Blob> {
  const { toPng } = await import("html-to-image");

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "-9999px";
  container.style.left = "-9999px";
  // .mcard is width:100% and sizes everything in cqw, so without an explicit
  // width the off-screen card collapses to 0×0 and toPng returns an empty image.
  container.style.width = "420px";
  container.style.pointerEvents = "none";
  document.body.appendChild(container);

  const root = createRoot(container);
  try {
    root.render(createElement(MembershipCard, props));
    // createRoot renders asynchronously; on a slow device two frames isn't always
    // enough, so wait (up to ~3s) until the card element actually exists.
    for (let i = 0; i < 180 && !container.firstElementChild; i++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const node = container.firstElementChild as HTMLElement | null;
    if (!node) throw new Error("Membership card failed to render.");
    // Wait for the logo so it's in the capture (a failed load just renders without it).
    await Promise.all(
      Array.from(node.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined)),
    );
    if (node.offsetWidth === 0 || node.offsetHeight === 0) {
      throw new Error("Membership card rendered with no size.");
    }

    const dataUrl = await toPng(node, { pixelRatio: 3, cacheBust: true });
    const res = await fetch(dataUrl);
    return await res.blob();
  } finally {
    root.unmount();
    container.remove();
  }
}
