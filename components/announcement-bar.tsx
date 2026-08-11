import type { AnnouncementCms } from "@/lib/gallery-cms/types";

/**
 * Each track repeats the message enough times that it's wider than any
 * realistic viewport — the scroller then only needs two tracks back to
 * back (one aria-hidden) to loop seamlessly at exactly -50%.
 */
const REPEAT_COUNT = 6;

function Track({ text, hidden }: { text: string; hidden?: boolean }) {
  return (
    <div className="announcement-bar__track" aria-hidden={hidden || undefined}>
      {Array.from({ length: REPEAT_COUNT }, (_, index) => (
        <span className="announcement-bar__item" key={index}>
          {text}
        </span>
      ))}
    </div>
  );
}

function isExternalHref(href: string): boolean {
  try {
    const url = new URL(href, "https://asosc.ca");
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin !== "https://asosc.ca"
      : false;
  } catch {
    return false;
  }
}

export function AnnouncementBar({ announcement }: { announcement: AnnouncementCms }) {
  const text = announcement.text.trim();
  if (!announcement.enabled || !text) return null;

  const href = announcement.href.trim();
  const barStyle = {
    "--announcement-speed": `${announcement.speedSeconds}s`,
  } as React.CSSProperties;
  const scroller = (
    <div
      className="announcement-bar__scroller"
      data-direction={announcement.direction === "rtl" ? "rtl" : undefined}
    >
      <Track text={text} />
      <Track text={text} hidden />
    </div>
  );

  if (!href) {
    return (
      <div
        className="announcement-bar"
        style={barStyle}
        data-pause-on-hover={announcement.pauseOnHover ? undefined : "false"}
        role="note"
        aria-label={text}
      >
        {scroller}
      </div>
    );
  }

  const external = isExternalHref(href);

  return (
    <div
      className="announcement-bar"
      style={barStyle}
      data-pause-on-hover={announcement.pauseOnHover ? undefined : "false"}
      role="note"
      aria-label={text}
    >
      <a
        className="announcement-bar__link"
        href={href}
        {...(external
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
      >
        {scroller}
      </a>
    </div>
  );
}
