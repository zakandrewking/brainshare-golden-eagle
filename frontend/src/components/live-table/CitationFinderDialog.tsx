import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import { ExternalLink, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CommandShortcut } from "@/components/ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { CellPosition } from "@/stores/selectionStore";

interface Citation {
  id: string;
  title: string;
  url: string;
  snippet: string;
  domain: string;
}

interface CitationFinderDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onLock: (note?: string) => void;
  selectedCells: CellPosition[];
}

export function CitationFinderDialog({
  isOpen,
  onOpenChange,
  onLock,
  selectedCells,
}: CitationFinderDialogProps) {
  const [citations, setCitations] = useState<Citation[]>([]);
  const [selectedCitationIds, setSelectedCitationIds] = useState<Set<string>>(
    new Set()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect platform for keyboard shortcut display
  const isMac =
    typeof navigator !== "undefined" &&
    navigator.userAgent.toUpperCase().indexOf("MAC") >= 0;
  const shortcutKey = isMac ? "⌘" : "Ctrl";

  const handleLockWithCitation = useCallback(() => {
    if (selectedCitationIds.size === 0) return;

    const selectedCitations = citations.filter((citation) =>
      selectedCitationIds.has(citation.id)
    );

    const citationNote = selectedCitations
      .map((citation) => `${citation.title}\n${citation.url}`)
      .join("\n\n");

    onLock(citationNote);
    setCitations([]);
    setSelectedCitationIds(new Set());
    setError(null);
    onOpenChange(false);
  }, [citations, selectedCitationIds, onLock, onOpenChange]);

  const handleCancel = useCallback(() => {
    setCitations([]);
    setSelectedCitationIds(new Set());
    setError(null);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleCitationToggle = useCallback((citationId: string) => {
    setSelectedCitationIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(citationId)) {
        newSet.delete(citationId);
      } else {
        newSet.add(citationId);
      }
      return newSet;
    });
  }, []);

  const findCitations = useCallback(async () => {
    if (selectedCells.length === 0) return;

    setIsLoading(true);
    setError(null);
    setCitations([]);

    try {
      // TODO: Implement actual citation finding with OpenAI API
      // For now, we'll show placeholder data
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate API call

      const mockCitations: Citation[] = [
        {
          id: "1",
          title: "Example Citation 1",
          url: "https://example.com/article1",
          snippet:
            "This is a relevant snippet from the first citation that relates to your selected data.",
          domain: "example.com",
        },
        {
          id: "2",
          title: "Example Citation 2",
          url: "https://example.com/article2",
          snippet:
            "This is another relevant snippet that provides additional context for your selection.",
          domain: "example.com",
        },
      ];

      setCitations(mockCitations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to find citations");
    } finally {
      setIsLoading(false);
    }
  }, [selectedCells]);

  // Start finding citations when dialog opens
  useEffect(() => {
    if (isOpen && selectedCells.length > 0) {
      findCitations();
    }
  }, [isOpen, selectedCells, findCitations]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (selectedCitationIds.size > 0) {
          handleLockWithCitation();
        }
      } else if (event.key === "Escape") {
        event.preventDefault();
        handleCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleLockWithCitation, handleCancel, selectedCitationIds.size]);

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      setCitations([]);
      setSelectedCitationIds(new Set());
      setError(null);
    }
    onOpenChange(open);
  };

  const cellCount = selectedCells.length;
  const cellText = cellCount === 1 ? "cell" : "cells";
  const selectedCount = selectedCitationIds.size;

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        data-testid="citation-finder-dialog"
        data-preserve-selection="true"
        className="max-w-2xl max-h-[80vh]"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Find Citations
          </DialogTitle>
          <DialogDescription>
            Finding relevant citations for {cellCount} selected {cellText}.
            Review and select citations to lock with your data.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Searching for citations...
              </div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-destructive mb-2">
                Error finding citations
              </div>
              <div className="text-sm text-muted-foreground mb-4">{error}</div>
              <Button onClick={findCitations} variant="outline" size="sm">
                Try Again
              </Button>
            </div>
          ) : citations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No citations found. Try selecting different cells or refining your
              data.
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-4">
                {citations.map((citation) => (
                  <div key={citation.id} className="border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={`citation-${citation.id}`}
                        checked={selectedCitationIds.has(citation.id)}
                        onCheckedChange={() =>
                          handleCitationToggle(citation.id)
                        }
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm mb-1">
                          {citation.title}
                        </h4>
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {citation.snippet}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{citation.domain}</span>
                          <a
                            href={citation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center hover:text-foreground transition-colors"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View source
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleLockWithCitation}
            disabled={selectedCount === 0}
            className="flex items-center gap-3"
          >
            Lock with {selectedCount} Citation{selectedCount === 1 ? "" : "s"}
            <CommandShortcut>{shortcutKey}+Enter</CommandShortcut>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CitationFinderDialog;
