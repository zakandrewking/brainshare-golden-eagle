import React, { useState } from "react";

import {
  Binary,
  Calendar,
  Hash,
  Image as ImageIcon,
  List,
  ToggleLeft,
  Type,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

import type { DataType } from "./LiveTableDoc";

interface DataTypeSelectorProps {
  currentDataType: DataType;
  currentEnumValues?: string[];
  onDataTypeChange: (dataType: DataType, enumValues?: string[]) => void;
  children?: React.ReactNode;
}

const DATA_TYPE_CONFIG = {
  text: {
    label: "Text",
    icon: <Type className="h-4 w-4" />,
    description: "Any string value",
  },
  integer: {
    label: "Integer",
    icon: <Hash className="h-4 w-4" />,
    description: "Whole numbers only",
  },
  decimal: {
    label: "Decimal",
    icon: <Binary className="h-4 w-4" />,
    description: "Numbers with decimal places",
  },
  datetime: {
    label: "Date & Time",
    icon: <Calendar className="h-4 w-4" />,
    description: "Date and time values",
  },
  enum: {
    label: "Enum",
    icon: <List className="h-4 w-4" />,
    description: "Predefined list of values",
  },
  boolean: {
    label: "Boolean",
    icon: <ToggleLeft className="h-4 w-4" />,
    description: "True/false values",
  },
  imageurl: {
    label: "Image URL",
    icon: <ImageIcon className="h-4 w-4" />,
    description: "Valid image URLs",
  },
} as const;

interface EnumConfigDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentValues?: string[];
  onSave: (values: string[]) => void;
}

function EnumConfigDialog({
  isOpen,
  onOpenChange,
  currentValues = [],
  onSave,
}: EnumConfigDialogProps) {
  const [values, setValues] = useState<string[]>(currentValues);
  const [newValue, setNewValue] = useState("");

  const handleAddValue = () => {
    const trimmedValue = newValue.trim();
    if (trimmedValue && !values.includes(trimmedValue)) {
      setValues([...values, trimmedValue]);
      setNewValue("");
    }
  };

  const handleRemoveValue = (index: number) => {
    setValues(values.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave(values);
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddValue();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure Enum Values</DialogTitle>
          <DialogDescription>
            Define the allowed values for this enum column. Users will be able
            to select from these options.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter a value..."
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <Button onClick={handleAddValue} disabled={!newValue.trim()}>
              Add
            </Button>
          </div>

          <div className="space-y-2 max-h-40 overflow-y-auto">
            {values.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No values defined yet.
              </p>
            ) : (
              values.map((value, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-2 p-2 border rounded"
                >
                  <span>{value}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveValue(index)}
                  >
                    ×
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DataTypeSelector({
  currentDataType,
  currentEnumValues,
  onDataTypeChange,
  children,
}: DataTypeSelectorProps) {
  const [isEnumDialogOpen, setIsEnumDialogOpen] = useState(false);

  const handleDataTypeSelect = (dataType: DataType) => {
    if (dataType === "enum") {
      setIsEnumDialogOpen(true);
    } else {
      onDataTypeChange(dataType);
    }
  };

  const handleEnumSave = (enumValues: string[]) => {
    onDataTypeChange("enum", enumValues);
  };

  const currentConfig = DATA_TYPE_CONFIG[currentDataType];

  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <div className="flex items-center gap-2">
            {currentConfig.icon}
            Set Data Type
            <span className="ml-auto text-xs text-muted-foreground">
              {currentConfig.label}
            </span>
          </div>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {Object.entries(DATA_TYPE_CONFIG).map(([dataType, config]) => (
            <DropdownMenuItem
              key={dataType}
              onClick={() => handleDataTypeSelect(dataType as DataType)}
              className="flex items-start gap-2"
            >
              <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
              <div className="flex flex-col">
                <span className="font-medium">{config.label}</span>
                <span className="text-xs text-muted-foreground">
                  {config.description}
                </span>
              </div>
              {currentDataType === dataType && (
                <span className="ml-auto text-xs font-semibold text-blue-600">
                  ✓
                </span>
              )}
            </DropdownMenuItem>
          ))}
          {currentDataType === "enum" && currentEnumValues && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsEnumDialogOpen(true)}>
                Configure Values ({currentEnumValues.length})
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <EnumConfigDialog
        isOpen={isEnumDialogOpen}
        onOpenChange={setIsEnumDialogOpen}
        currentValues={currentEnumValues}
        onSave={handleEnumSave}
      />
    </>
  );
}
