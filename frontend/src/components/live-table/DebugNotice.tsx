import React from "react";

import { Bug } from "lucide-react";

import { useIsAiFillSelectionDebugEnabled } from "@/stores/debugSettingsStore";

export function DebugNotice() {
  const isDebugEnabled = useIsAiFillSelectionDebugEnabled();

  if (!isDebugEnabled) {
    return null;
  }

  return (
    <div className="fixed top-3 right-46 z-30 bg-muted border border-border px-2 py-1 rounded text-xs text-muted-foreground flex items-center gap-1 shadow-sm">
      <Bug size={12} />
      DEBUG
    </div>
  );
}
