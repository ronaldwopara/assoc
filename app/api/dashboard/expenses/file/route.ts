import { isUpgradeAuthenticated } from "@/lib/gallery-cms/auth";
import { getAccessTokenForAccount, getSheetValues } from "@/lib/google-sheets";
import { colIndex, MASTER_TABS, masterSheetId } from "@/lib/master-sheet";

export const maxDuration = 30;

/**
 * Opens a saved bill/receipt file (?id=<Gmail message id>) through the
 * dashboard, using the Google account that saved it, so staff never have to
 * request access in Google Drive.
 */
export async function GET(request: Request) {
  if (!(await isUpgradeAuthenticated())) return new Response("Unauthorized", { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) return new Response("Invalid id", { status: 400 });
  try {
    const { accessToken } = await getAccessTokenForAccount();
    const [headers = [], ...rows] = await getSheetValues(accessToken, masterSheetId(), MASTER_TABS.expenses);
    const row = rows.find((r) => String(r[colIndex(headers, "Gmail Message ID")] ?? "").trim() === id);
    if (!row) return new Response("Not found", { status: 404 });
    const link = String(row[colIndex(headers, "Attachment Link")] ?? "");
    const fileId = link.match(/\/d\/([A-Za-z0-9_-]{10,})/)?.[1] ?? link.match(/[?&]id=([A-Za-z0-9_-]{10,})/)?.[1];
    if (!fileId) return new Response("No file saved for this one", { status: 404 });
    const inbox = String(row[colIndex(headers, "Inbox")] ?? "").trim();
    // The file lives in the Drive of the inbox that received the email.
    const owner = await getAccessTokenForAccount(inbox || undefined).catch(() => getAccessTokenForAccount());
    const auth = { Authorization: `Bearer ${owner.accessToken}` };
    const meta = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`, { headers: auth, cache: "no-store" });
    if (!meta.ok) return new Response("This file couldn't be opened", { status: 502 });
    const { name, mimeType } = (await meta.json()) as { name?: string; mimeType?: string };
    const file = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: auth, cache: "no-store" });
    if (!file.ok || !file.body) return new Response("This file couldn't be opened", { status: 502 });
    return new Response(file.body, {
      headers: {
        "Content-Type": mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${(name || "file").replace(/["\\\r\n]/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Couldn't open the file", { status: 500 });
  }
}
