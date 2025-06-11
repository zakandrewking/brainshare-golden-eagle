import React, { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BooleanCellEditorProps {
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

function parseBooleanValue(value: string): boolean | null {
  if (!value) return null;

  const normalizedValue = value.toString().toLowerCase().trim();

  if (["true", "yes", "1", "on"].includes(normalizedValue)) {
    return true;
  }

  if (["false", "no", "0", "off"].includes(normalizedValue)) {
    return false;
  }

  return null;
}

function formatBooleanValue(boolValue: boolean | null): string {
  if (boolValue === true) return "true";
  if (boolValue === false) return "false";
  return "";
}

export function BooleanCellEditor({
  value,
  onSave,
  onCancel,
}: BooleanCellEditorProps) {
  const currentBoolValue = parseBooleanValue(value);
  const [selectedValue, setSelectedValue] = useState(
    currentBoolValue === null ? "" : currentBoolValue.toString()
  );

  const handleValueChange = (newValue: string) => {
    setSelectedValue(newValue);
    const formattedValue =
      newValue === "" ? "" : formatBooleanValue(newValue === "true");
    onSave(formattedValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <Select value={selectedValue} onValueChange={handleValueChange}>
      <SelectTrigger className="w-full" onKeyDown={handleKeyDown} autoFocus>
        <SelectValue placeholder="Select value..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">None</SelectItem>
        <SelectItem value="true">True</SelectItem>
        <SelectItem value="false">False</SelectItem>
      </SelectContent>
    </Select>
  );
}
