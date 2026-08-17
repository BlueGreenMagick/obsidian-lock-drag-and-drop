import type { View } from "obsidian";

export function getViewDisplayText(view: View | null): string {
  return view?.getDisplayText().trim() || view?.getViewType() || "Current view";
}
