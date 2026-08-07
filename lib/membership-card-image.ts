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
  container.style.pointerEvents = "none";
  document.body.appendChild(container);

  const root = createRoot(container);
  try {
    await new Promise<void>((resolve) => {
      root.render(createElement(MembershipCard, props));
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const node = container.firstElementChild as HTMLElement | null;
    if (!node) throw new Error("Membership card failed to render.");

    const dataUrl = await toPng(node, { pixelRatio: 3, cacheBust: true });
    const res = await fetch(dataUrl);
    return await res.blob();
  } finally {
    root.unmount();
    container.remove();
  }
}
