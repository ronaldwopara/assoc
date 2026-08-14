import {
  ensureSheetTab,
  getAccessTokenForAccount,
  getSheetRange,
  updateSheetRange,
} from "@/lib/google-sheets";
import { resolveDashboardSheetId } from "@/lib/dashboard-sheets";
import { FLOW_META, defaultFlowEmailTemplate, type EmailFlowId, type FlowEmailTemplate } from "@/lib/flow-email-render";

export type { EmailFlowId, FlowEmailTemplate } from "@/lib/flow-email-render";
export { FLOW_META } from "@/lib/flow-email-render";

/** A1=body, B1=subject, B2=button label, B3=button URL, B4=preheader, then flow-specific extra rows. */
function rangeForFlow(flow: EmailFlowId): string {
  if (flow === "donate") return "A1:B6"; // + B5 etransferBlock, B6 cardBlock
  if (flow === "newsletter") return "A1:B5"; // + B5 unsubscribe
  return "A1:B4";
}

function templateFromRange(flow: EmailFlowId, values: string[][]): FlowEmailTemplate {
  const cell = (row: number, col: number) => String(values[row]?.[col] ?? "").trim();
  const fallback = defaultFlowEmailTemplate(flow);

  const template: FlowEmailTemplate = {
    body: cell(0, 0) || fallback.body,
    subject: cell(0, 1) || fallback.subject,
    buttonLabel: cell(1, 1),
    buttonUrl: cell(2, 1),
    preheader: cell(3, 1),
  };

  if (flow === "donate") {
    template.etransferBlock = cell(4, 1) || fallback.etransferBlock;
    template.cardBlock = cell(5, 1) || fallback.cardBlock;
  }
  if (flow === "newsletter") {
    template.unsubscribe = cell(4, 1) || fallback.unsubscribe;
  }

  return template;
}

function templateToRange(flow: EmailFlowId, template: FlowEmailTemplate): string[][] {
  const rows: string[][] = [
    [template.body, template.subject],
    ["", template.buttonLabel],
    ["", template.buttonUrl],
    ["", template.preheader],
  ];
  if (flow === "donate") {
    rows.push(["", template.etransferBlock ?? ""]);
    rows.push(["", template.cardBlock ?? ""]);
  }
  if (flow === "newsletter") {
    rows.push(["", template.unsubscribe ?? ""]);
  }
  return rows;
}

/** Reads a flow's template, self-healing its tab with defaults if it doesn't exist yet. */
export async function getFlowEmailTemplate(flow: EmailFlowId): Promise<FlowEmailTemplate> {
  const meta = FLOW_META[flow];
  const spreadsheetId = resolveDashboardSheetId(meta.source);
  const { accessToken } = await getAccessTokenForAccount();

  await ensureSheetTab(accessToken, spreadsheetId, meta.sheetTab);
  const range = rangeForFlow(flow);
  const values = await getSheetRange(accessToken, spreadsheetId, meta.sheetTab, range);

  if (!values.length) {
    const defaults = defaultFlowEmailTemplate(flow);
    await updateSheetRange(accessToken, spreadsheetId, meta.sheetTab, range, templateToRange(flow, defaults));
    return defaults;
  }

  return templateFromRange(flow, values);
}

export async function saveFlowEmailTemplate(flow: EmailFlowId, template: FlowEmailTemplate): Promise<void> {
  const meta = FLOW_META[flow];
  const spreadsheetId = resolveDashboardSheetId(meta.source);
  const { accessToken } = await getAccessTokenForAccount();

  await ensureSheetTab(accessToken, spreadsheetId, meta.sheetTab);
  await updateSheetRange(
    accessToken,
    spreadsheetId,
    meta.sheetTab,
    rangeForFlow(flow),
    templateToRange(flow, template),
  );
}
