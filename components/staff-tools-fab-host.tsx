"use client";

import { Suspense } from "react";
import { StaffToolsFab } from "@/components/staff-tools-fab";

/** Suspense boundary — StaffToolsFab reads useSearchParams. */
export function StaffToolsFabHost() {
  return (
    <Suspense fallback={null}>
      <StaffToolsFab />
    </Suspense>
  );
}
