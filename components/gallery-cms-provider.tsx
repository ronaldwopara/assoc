"use client";

import { createContext, useContext } from "react";
import type { GalleryCmsData } from "@/lib/gallery-cms/types";

const EMPTY_CMS: GalleryCmsData = {
  version: 1,
  updatedAt: "",
  programs: [],
};

const GalleryCmsContext = createContext<GalleryCmsData>(EMPTY_CMS);

export function GalleryCmsProvider({
  data,
  children,
}: {
  data: GalleryCmsData;
  children: React.ReactNode;
}) {
  return (
    <GalleryCmsContext.Provider value={data}>{children}</GalleryCmsContext.Provider>
  );
}

export function useGalleryCms() {
  return useContext(GalleryCmsContext);
}
