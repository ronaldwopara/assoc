export type UpgradeToolId =
  | "dashboard"
  | "gallery"
  | "announcement"
  | "documents"
  | "popup"
  | "documentaries"
  | "site";

export type UpgradeTool = {
  id: UpgradeToolId;
  title: string;
  description: string;
};

export const UPGRADE_TOOLS: UpgradeTool[] = [
  {
    id: "site",
    title: "Site sections",
    description: "Change the words and pictures on every part of the website.",
  },
  {
    id: "dashboard",
    title: "Dashboard",
    description: "View membership, finance, and master list spreadsheets.",
  },
  {
    id: "gallery",
    title: "Gallery",
    description: "Manage program previews, years, and Google Photos album links.",
  },
  {
    id: "announcement",
    title: "Announcement bar",
    description: "Edit the site-wide announcement message and optional link.",
  },
  {
    id: "documents",
    title: "Documents",
    description: "Upload and organize About Us downloads — reports, bylaws, and plans.",
  },
  {
    id: "popup",
    title: "Popup",
    description: "Homepage flyer popup after scrolling into About Us — one active campaign.",
  },
  {
    id: "documentaries",
    title: "Documentaries",
    description: "Add the films licence holders can watch on the Stories page.",
  },
];

const VALID_TOOL_IDS = new Set<UpgradeToolId>(
  UPGRADE_TOOLS.map((tool) => tool.id),
);

export function isValidUpgradeToolId(value: string | null): value is UpgradeToolId {
  return value !== null && VALID_TOOL_IDS.has(value as UpgradeToolId);
}

export function upgradeToolHref(tool: UpgradeToolId): string {
  return `/upgrade?tool=${tool}`;
}
