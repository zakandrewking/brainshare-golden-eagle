"use client";

import { useEffect, useState } from "react";

import {
  Check,
  Edit2,
  Info,
  X,
} from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

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

const SWR_DOCUMENT_KEY = "documentTitleAndDescription";

interface EditableFlexTitleProps {
  onUpdate: (updates: {
    title?: string;
    description?: string;
  }) => Promise<void>;
}

export default function EditableFlexTitle({
  onUpdate,
}: EditableFlexTitleProps) {
  const {
    data: swrData,
    error: swrError,
    isLoading: swrIsLoading,
    mutate: swrMutate,
  } = useSWR<{ title: string; description: string } | undefined>(
    SWR_DOCUMENT_KEY,
    {
      fallbackData: { title: "", description: "" },
    }
  );

  const titleFromSWR = swrData?.title ?? "";
  const descriptionFromSWR = swrData?.description ?? "";

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedTitle, setEditedTitle] = useState(titleFromSWR);
  const [editedDescription, setEditedDescription] =
    useState(descriptionFromSWR);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!isEditingTitle) {
      setEditedTitle(titleFromSWR);
    }
  }, [titleFromSWR, isEditingTitle]);

  useEffect(() => {
    if (!isEditingDescription) {
      setEditedDescription(descriptionFromSWR);
    }
  }, [descriptionFromSWR, isEditingDescription]);

  if (swrError) {
    console.error("SWR error in EditableFlexTitle:", swrError);
    toast.error("Failed to load document details. Please try again later.");
  }

  const handleTitleEdit = () => {
    setEditedTitle(titleFromSWR);
    setIsEditingTitle(true);
  };

  const handleTitleSave = async () => {
    const trimmedTitle = editedTitle.trim();
    if (trimmedTitle === titleFromSWR) {
      setIsEditingTitle(false);
      return;
    }

    if (trimmedTitle.length < 3) {
      toast.error("Title must be at least 3 characters long");
      return;
    }

    setIsUpdating(true);
    const previousData = swrData;

    try {
      swrMutate(
        (currentData) => ({
          title: trimmedTitle,
          description: currentData?.description ?? descriptionFromSWR,
        }),
        { revalidate: false }
      );
      await onUpdate({ title: trimmedTitle });
      setIsEditingTitle(false);
      toast.success("Title updated successfully");
      swrMutate();
    } catch (error) {
      console.error("Failed to update title:", error);
      toast.error("Failed to update title");
      if (previousData) {
        swrMutate(previousData, { revalidate: false });
      }
      setEditedTitle(titleFromSWR);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTitleCancel = () => {
    setEditedTitle(titleFromSWR);
    setIsEditingTitle(false);
  };

  const handleDescriptionEdit = () => {
    setEditedDescription(descriptionFromSWR);
    setIsEditingDescription(true);
  };

  const handleDescriptionSave = async () => {
    const trimmedDescription = editedDescription.trim();
    if (trimmedDescription === descriptionFromSWR) {
      setIsEditingDescription(false);
      return;
    }

    setIsUpdating(true);
    const previousData = swrData;
    try {
      swrMutate(
        (currentData) => ({
          description: trimmedDescription,
          title: currentData?.title ?? titleFromSWR,
        }),
        { revalidate: false }
      );
      await onUpdate({ description: trimmedDescription });
      setIsEditingDescription(false);
      toast.success("Description updated successfully");
      swrMutate();
    } catch (error) {
      console.error("Failed to update description:", error);
      toast.error("Failed to update description");
      if (previousData) {
        swrMutate(previousData, { revalidate: false });
      }
      setEditedDescription(descriptionFromSWR);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDescriptionCancel = () => {
    setEditedDescription(descriptionFromSWR);
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
          <h2
            className="text-2xl font-bold truncate min-w-0"
            title={titleFromSWR}
          >
            {swrIsLoading && !swrData?.title ? "Loading..." : titleFromSWR}
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
          <Button variant="ghost" size="icon" className="flex-shrink-0">
            <Info size={16} />
            <span className="sr-only">View description</span>
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {swrIsLoading && !swrData?.title ? "Loading..." : titleFromSWR}
            </DialogTitle>
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
                  <DialogDescription>
                    {swrIsLoading && !swrData?.description
                      ? "Loading..."
                      : descriptionFromSWR}
                  </DialogDescription>
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
