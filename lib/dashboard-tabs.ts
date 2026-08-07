import type { DashboardListId } from "@/lib/dashboard-lists";
import { listMeta } from "@/lib/dashboard-lists";

export type DashboardTab = {
  id: DashboardListId;
  title: string;
};

export function createTab(listId: DashboardListId): DashboardTab {
  const meta = listMeta(listId);
  return { id: listId, title: meta.title };
}

export function openTabInSet(
  tabs: DashboardTab[],
  listId: DashboardListId,
): { tabs: DashboardTab[]; activeId: DashboardListId } {
  const exists = tabs.some((t) => t.id === listId);
  if (exists) {
    return { tabs, activeId: listId };
  }
  return { tabs: [...tabs, createTab(listId)], activeId: listId };
}

export function closeTabInSet(
  tabs: DashboardTab[],
  activeId: DashboardListId,
  listId: DashboardListId,
): { tabs: DashboardTab[]; activeId: DashboardListId } {
  const nextTabs = tabs.filter((t) => t.id !== listId);
  if (nextTabs.length === 0) {
    const fallback = createTab("master-list");
    return { tabs: [fallback], activeId: fallback.id };
  }
  const nextActive =
    activeId === listId ? nextTabs[nextTabs.length - 1].id : activeId;
  return { tabs: nextTabs, activeId: nextActive };
}
