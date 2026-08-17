/** Minimal Drive helpers for filing email attachments (invoices/receipts). Uses the
 * `drive.file` scope already granted in lib/google-oauth.ts — the app can only see
 * folders/files it created itself, so callers should always go through
 * findOrCreateFolder() rather than assuming a folder already exists. */

async function driveApiFetch(url: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Drive API request failed (${response.status})`);
  }
  return payload;
}

const folderCache = new Map<string, Promise<string>>();

/** Finds a folder by exact name (created by this app), creating it if it doesn't exist yet.
 * Cache key includes the access token — each connected Google account has its own Drive,
 * so a folder id created under one account is meaningless (404s) under another's token. */
export async function findOrCreateFolder(
  accessToken: string,
  name: string,
  parentId?: string,
): Promise<string> {
  const cacheKey = `${accessToken}::${name}::${parentId ?? ""}`;
  const cached = folderCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    const parentClause = parentId ? ` and '${parentId}' in parents` : "";
    const query = `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentClause}`;
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", query);
    url.searchParams.set("fields", "files(id,name)");
    url.searchParams.set("pageSize", "1");

    const list = (await driveApiFetch(url.toString(), accessToken)) as { files?: Array<{ id: string }> };
    if (list.files && list.files.length > 0) return list.files[0].id;

    const created = (await driveApiFetch("https://www.googleapis.com/drive/v3/files", accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: parentId ? [parentId] : undefined,
      }),
    })) as { id: string };
    return created.id;
  })();

  folderCache.set(cacheKey, promise);
  promise.catch(() => folderCache.delete(cacheKey));
  return promise;
}

/** Uploads a file into a folder and returns its id + a link staff can open. */
export async function uploadDriveFile(
  accessToken: string,
  folderId: string,
  filename: string,
  mimeType: string,
  data: Buffer,
): Promise<{ id: string; webViewLink: string }> {
  const boundary = `asosc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const metadata = JSON.stringify({ name: filename, parents: [folderId] });

  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`,
    ),
    Buffer.from(data.toString("base64")),
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Failed to upload file (${response.status})`);
  }
  return { id: payload.id, webViewLink: payload.webViewLink ?? `https://drive.google.com/file/d/${payload.id}/view` };
}
