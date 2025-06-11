import React, { useState } from "react";

import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ImageUrlCellEditorProps {
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

function isValidImageUrl(url: string): boolean {
  if (!url) return false;

  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.protocol.startsWith("http")) return false;

    const imageExtensions =
      /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff)(\?[^#]*)?(\#.*)?$/i;
    return (
      imageExtensions.test(parsedUrl.pathname) ||
      /\/wiki\/.*#\/media\/File:.*\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff)/i.test(
        url
      )
    );
  } catch {
    return false;
  }
}

export function ImageUrlCellEditor({
  value,
  onSave,
  onCancel,
}: ImageUrlCellEditorProps) {
  const [localValue, setLocalValue] = useState(value);
  const [imageError, setImageError] = useState(false);

  const isValid = isValidImageUrl(localValue);
  const showPreview = isValid && localValue !== value;

  const handleSave = () => {
    onSave(localValue.trim());
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

  const handleImageLoad = () => {
    setImageError(false);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const handleClear = () => {
    setLocalValue("");
    setImageError(false);
  };

  return (
    <div className="w-full p-2 space-y-2">
      <div className="flex gap-2">
        <Input
          type="url"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          placeholder="Enter image URL..."
          autoFocus
          className="flex-1"
        />
        {localValue && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="px-2"
          >
            Clear
          </Button>
        )}
      </div>

      {showPreview && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Preview:</div>
          <div className="border rounded p-1 bg-muted/50">
            {imageError ? (
              <div className="text-xs text-red-500 p-2">
                Failed to load image. Please check the URL.
              </div>
            ) : (
              <Image
                src={localValue}
                alt="Preview"
                width={150}
                height={96}
                className="max-w-full max-h-24 object-contain rounded"
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            )}
          </div>
        </div>
      )}

      {localValue && !isValid && (
        <div className="text-xs text-red-500">
          Please enter a valid image URL (jpg, png, gif, webp, svg, etc.)
        </div>
      )}
    </div>
  );
}
