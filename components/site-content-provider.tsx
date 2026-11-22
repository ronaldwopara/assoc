"use client";

import { createContext, useContext } from "react";
import { buildSeedSiteContent } from "@/lib/site-content/seed";
import type { SiteContent } from "@/lib/site-content/types";

const SiteContentContext = createContext<SiteContent | null>(null);

export function SiteContentProvider({ data, children }: { data: SiteContent; children: React.ReactNode }) {
  return <SiteContentContext.Provider value={data}>{children}</SiteContentContext.Provider>;
}

/** The editable site content (falls back to the original wording outside the provider). */
export function useSiteContent(): SiteContent {
  return useContext(SiteContentContext) ?? buildSeedSiteContent();
}
