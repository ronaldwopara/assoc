import { getGoogleOAuthConfig, listGoogleAccounts } from "@/lib/google-oauth";

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = getGoogleOAuthConfig();

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const payload = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description || payload.error || "Failed to refresh Google access token",
    );
  }

  return payload.access_token;
}

/** Access token for the first connected Google account (or a specific email). */
export async function getAccessTokenForAccount(email?: string) {
  const accounts = await listGoogleAccounts();
  const account = email
    ? accounts.find((a) => a.email.toLowerCase() === email.toLowerCase())
    : accounts[0];

  if (!account) {
    throw new Error(email ? `No connected Google account for ${email}` : "No Google account connected");
  }

  return {
    email: account.email,
    accessToken: await refreshAccessToken(account.refreshToken),
  };
}

async function googleApiFetch(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Google API request failed (${response.status})`);
  }
  return payload;
}

export type DriveSpreadsheetSummary = {
  id: string;
  name: string;
  modifiedTime: string;
  owners: string[];
  webViewLink: string;
};

/** Every Google Sheet the connected account can see — Drive files.list, spreadsheets only. */
export async function listSpreadsheets(accessToken: string): Promise<DriveSpreadsheetSummary[]> {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  url.searchParams.set("fields", "files(id,name,modifiedTime,owners(emailAddress),webViewLink)");
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("orderBy", "modifiedTime desc");

  const payload = (await googleApiFetch(url.toString(), accessToken)) as {
    files?: Array<{
      id: string;
      name: string;
      modifiedTime: string;
      owners?: Array<{ emailAddress: string }>;
      webViewLink: string;
    }>;
  };

  return (payload.files ?? []).map((file) => ({
    id: file.id,
    name: file.name,
    modifiedTime: file.modifiedTime,
    owners: (file.owners ?? []).map((o) => o.emailAddress),
    webViewLink: file.webViewLink,
  }));
}

export type SpreadsheetTab = {
  title: string;
  sheetId: number;
  rowCount: number;
  columnCount: number;
};

/** Tab names + grid size for one spreadsheet. */
export async function getSpreadsheetTabs(
  accessToken: string,
  spreadsheetId: string,
): Promise<{ title: string; tabs: SpreadsheetTab[] }> {
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`);
  url.searchParams.set("fields", "properties.title,sheets.properties");

  const payload = (await googleApiFetch(url.toString(), accessToken)) as {
    properties?: { title?: string };
    sheets?: Array<{
      properties: {
        title: string;
        sheetId: number;
        gridProperties?: { rowCount?: number; columnCount?: number };
      };
    }>;
  };

  return {
    title: payload.properties?.title ?? spreadsheetId,
    tabs: (payload.sheets ?? []).map((sheet) => ({
      title: sheet.properties.title,
      sheetId: sheet.properties.sheetId,
      rowCount: sheet.properties.gridProperties?.rowCount ?? 0,
      columnCount: sheet.properties.gridProperties?.columnCount ?? 0,
    })),
  };
}

/** Raw row values for one tab (first row assumed to be headers). */
export async function getSheetValues(
  accessToken: string,
  spreadsheetId: string,
  tabTitle: string,
): Promise<string[][]> {
  const range = encodeURIComponent(tabTitle);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;

  const payload = (await googleApiFetch(url, accessToken)) as { values?: string[][] };
  return payload.values ?? [];
}

/** Overwrite one row in place. `rowNumber` is 1-indexed and includes the header row. */
export async function updateSheetRow(
  accessToken: string,
  spreadsheetId: string,
  tabTitle: string,
  rowNumber: number,
  values: string[],
): Promise<void> {
  const range = encodeURIComponent(`${tabTitle}!A${rowNumber}:${columnLetter(values.length)}${rowNumber}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [values] }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message || `Failed to update row (${response.status})`);
  }
}

/** Append a new row at the end of the tab. Returns the 1-indexed row number it landed on. */
export async function appendSheetRow(
  accessToken: string,
  spreadsheetId: string,
  tabTitle: string,
  values: string[],
): Promise<number> {
  const range = encodeURIComponent(tabTitle);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [values] }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Failed to add row (${response.status})`);
  }

  const updatedRange = (payload as { updates?: { updatedRange?: string } })?.updates?.updatedRange ?? "";
  const match = updatedRange.match(/![A-Za-z]+(\d+)/);
  if (!match) throw new Error("Added the row but couldn't determine its row number");
  return Number(match[1]);
}

function columnLetter(count: number): string {
  let n = Math.max(count, 1);
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}
