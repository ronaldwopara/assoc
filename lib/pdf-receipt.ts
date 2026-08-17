import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/** WinAnsi (the standard font encoding) can't render zero-width joiners, smart quotes
 * outside Latin-1, emoji, etc. that show up constantly in real email bodies — strip/fold
 * anything outside the printable Latin-1 range rather than letting pdf-lib throw. */
function toWinAnsiSafe(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/–/g, "-")
    .replace(/—/g, "--")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "");
}

/** Renders a plain-text email (no attachment) as a one-page PDF so there's always a
 * filed copy in Drive, even for senders (Interac debits) that never attach a file. */
export async function renderEmailAsPdf(fields: {
  title: string;
  from: string;
  date: string;
  subject: string;
  body: string;
}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 54;
  const maxWidth = pageWidth - margin * 2;
  const fontSize = 10;
  const lineHeight = 14;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const newPage = () => {
    page = doc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  const drawLine = (text: string, opts?: { bold?: boolean; size?: number }) => {
    if (y < margin) newPage();
    page.drawText(text, {
      x: margin,
      y,
      size: opts?.size ?? fontSize,
      font: opts?.bold ? bold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= lineHeight;
  };

  const wrap = (text: string): string[] => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  drawLine(toWinAnsiSafe(fields.title), { bold: true, size: 14 });
  y -= 6;
  drawLine(toWinAnsiSafe(`From: ${fields.from}`));
  drawLine(toWinAnsiSafe(`Date: ${fields.date}`));
  drawLine(toWinAnsiSafe(`Subject: ${fields.subject}`));
  y -= 10;

  for (const paragraph of toWinAnsiSafe(fields.body).split(/\n+/)) {
    if (!paragraph.trim()) {
      y -= lineHeight / 2;
      continue;
    }
    for (const line of wrap(paragraph.trim())) drawLine(line);
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
