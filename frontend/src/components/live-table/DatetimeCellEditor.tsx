import React, { useState } from "react";

import { Input } from "@/components/ui/input";

interface DatetimeCellEditorProps {
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

function parseToDatetimeLocal(value: string): string {
  if (!value) return "";

  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return "";
  }
}

function parseFromDatetimeLocal(datetimeLocal: string): string {
  if (!datetimeLocal) return "";

  try {
    const date = new Date(datetimeLocal);
    if (isNaN(date.getTime())) return "";

    return date.toISOString();
  } catch {
    return "";
  }
}

export function DatetimeCellEditor({
  value,
  onSave,
  onCancel,
}: DatetimeCellEditorProps) {
  const [localValue, setLocalValue] = useState(() =>
    parseToDatetimeLocal(value)
  );

  const handleSave = () => {
    const isoValue = parseFromDatetimeLocal(localValue);
    onSave(isoValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <Input
      type="datetime-local"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={handleKeyDown}
      autoFocus
      className="w-full"
    />
  );
}
