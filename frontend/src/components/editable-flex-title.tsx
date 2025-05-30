"use client";

import { useState } from "react";

import {
  Check,
  Edit2,
  Info,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface EditableFlexTitleProps {
  title: string;
  description: string;
  onUpdate: (updates: { title?: string; description?: string }) => Promise<void>;
}

export default function EditableFlexTitle({
  title,
  description,
  onUpdate,
}: EditableFlexTitleProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [editedDescription, setEditedDescription] = useState(description);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleTitleEdit = () => {
    setEditedTitle(title);
    setIsEditingTitle(true);
  };

  const handleTitleSave = async () => {
    if (editedTitle.trim() === title) {
      setIsEditingTitle(false);
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdate({ title: editedTitle.trim() });
      setIsEditingTitle(false);
      toast.success("Title updated successfully");
    } catch (error) {
      console.error("Failed to update title:", error);
      toast.error("Failed to update title");
      setEditedTitle(title);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTitleCancel = () => {
    setEditedTitle(title);
    setIsEditingTitle(false);
  };

  const handleDescriptionEdit = () => {
    setEditedDescription(description);
    setIsEditingDescription(true);
  };

  const handleDescriptionSave = async () => {
    if (editedDescription.trim() === description) {
      setIsEditingDescription(false);
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdate({ description: editedDescription.trim() });
      setIsEditingDescription(false);
      toast.success("Description updated successfully");
    } catch (error) {
      console.error("Failed to update description:", error);
      toast.error("Failed to update description");
      setEditedDescription(description);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDescriptionCancel = () => {
    setEditedDescription(description);
    setIsEditingDescription(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === "Escape") {
      handleTitleCancel();
    }
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      handleDescriptionSave();
    } else if (e.key === "Escape") {
      handleDescriptionCancel();
    }
  };

  return (
    <div className="mt-14 w-full flex items-center justify-start space-x-2">
      {isEditingTitle ? (
        <div className="flex items-center space-x-2 flex-1">
          <Input
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            className="text-2xl font-bold h-auto py-1"
            disabled={isUpdating}
            autoFocus
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={handleTitleSave}
            disabled={isUpdating}
          >
            <Check className="h-4 w-4" />
            <span className="sr-only">Save title</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={handleTitleCancel}
            disabled={isUpdating}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Cancel editing</span>
          </Button>
        </div>
      ) : (
        <div className="flex items-center space-x-2 flex-1">
          <h2 className="text-2xl font-bold truncate min-w-0" title={title}>
            {title}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={handleTitleEdit}
          >
            <Edit2 className="h-4 w-4" />
            <span className="sr-only">Edit title</span>
          </Button>
        </div>
      )}

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
            <Info className="h-4 w-4" />
            <span className="sr-only">View description</span>
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <div className="space-y-4">
              {isEditingDescription ? (
                <div className="space-y-2">
                  <Textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    onKeyDown={handleDescriptionKeyDown}
                    placeholder="Enter description..."
                    disabled={isUpdating}
                    autoFocus
                    rows={4}
                  />
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      onClick={handleDescriptionSave}
                      disabled={isUpdating}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDescriptionCancel}
                      disabled={isUpdating}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Press Ctrl+Enter to save, Escape to cancel
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <DialogDescription>{description}</DialogDescription>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDescriptionEdit}
                  >
                    <Edit2 className="h-4 w-4 mr-1" />
                    Edit Description
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
