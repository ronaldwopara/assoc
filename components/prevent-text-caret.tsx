"use client";

import { useEffect } from "react";

const EDITABLE_SELECTOR =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
const INTERACTIVE_SELECTOR = `${EDITABLE_SELECTOR}, button, a, summary, [tabindex]:not([tabindex="-1"])`;

export function PreventTextCaret() {
  useEffect(() => {
    const clearCollapsedSelection = () => {
      const selection = window.getSelection();
      if (selection?.isCollapsed) {
        selection.removeAllRanges();
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest(EDITABLE_SELECTOR)) return;
      if (target.matches(INTERACTIVE_SELECTOR)) return;
      target.blur();
      clearCollapsedSelection();
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest(EDITABLE_SELECTOR)) return;
      if (target.closest("a")) return;
      if (target.closest(INTERACTIVE_SELECTOR)) return;

      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;

      clearCollapsedSelection();
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return null;
}
