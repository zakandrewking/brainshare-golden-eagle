import React, { useCallback, useEffect, useMemo, useState } from "react";

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
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDocumentDescription,
  useDocumentTitle,
  useHeaders,
  useTableData,
} from "@/stores/dataStore";
import { useIsAiFillSelectionDebugEnabled } from "@/stores/debugSettingsStore";
import type { CellPosition } from "@/stores/selectionStore";

import findCitations, {
  type Citation as ServerCitation,
} from "./actions/find-citations";
import { getSelectedCellsData } from "./data-utils";

function outputDebugTestCase(
  tableData: Record<string, unknown>[],
  headers: string[],
  selectedCells: { rowIndex: number; colIndex: number; value: string }[],
  documentTitle: string,
  documentDescription: string
) {
  const testCase = {
    title: documentTitle,
    description: documentDescription,
    tableData,
    headers,
    selectedCells,
    expectedCitedValues: selectedCells,
  };

  console.log("\n" + "=".repeat(20));
  console.log("🔍 CITATION FINDER DEBUG - TEST CASE DATA");
  console.log("=".repeat(20));
  console.log("Copy the JSON below to add as a new test case:");
  console.log("=".repeat(20));
  console.log(JSON.stringify(testCase, null, 2));
  console.log("=".repeat(20));
  console.log("📝 Instructions:");
  console.log("1. Copy the JSON above");
  console.log(
    "2. Add it to the testCases array in src/__tests__/components/live-table/actions/find-citations-test-cases.json5"
  );
  console.log(
    "3. Run the test with: GEMINI_API_KEY=your_key RUN_AI_TESTS=true npm test -- find-citations.manual.test.ts"
  );
  console.log("=".repeat(20) + "\n");
}

interface Citation extends ServerCitation {
  id: string;
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
  const [searchContext, setSearchContext] = useState<string | null>(null);
  const [hasStartedSearch, setHasStartedSearch] = useState(false);

  // Get table data
  const tableData = useTableData();
  const headers = useHeaders();
  const documentTitle = useDocumentTitle();
  const documentDescription = useDocumentDescription();

  const selectedCellsData = useMemo(() => {
    return getSelectedCellsData(tableData, headers, selectedCells);
  }, [tableData, headers, selectedCells]);

  const isDebugEnabled = useIsAiFillSelectionDebugEnabled();

  // Detect platform for keyboard shortcut display
  const isMac =
    typeof navigator !== "undefined" &&
    navigator.userAgent.toUpperCase().indexOf("MAC") >= 0;
  const shortcutKey = isMac ? "⌘" : "Ctrl";

  // Helper to extract domain from URL
  const getDomainFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, "");
    } catch {
      return "unknown";
    }
  };

  // Get selected cell values for preview
  const getSelectedCellsPreview = useCallback(() => {
    if (!tableData || selectedCells.length === 0) return [];

    return selectedCells.slice(0, 5).map((cell) => {
      const value = tableData[cell.rowIndex]?.[`col${cell.colIndex}`] || "";
      const header = headers[cell.colIndex] || `Column ${cell.colIndex + 1}`;
      return { header, value, row: cell.rowIndex + 1, col: cell.colIndex + 1 };
    });
  }, [tableData, headers, selectedCells]);

  // Get original values for comparison with citations
  const getOriginalValuesForCitations = useCallback(() => {
    if (!tableData || selectedCells.length === 0)
      return new Map<string, string>();

    const originalValues = new Map<string, string>();
    selectedCells.forEach((cell) => {
      const value = String(
        tableData[cell.rowIndex]?.[`col${cell.colIndex}`] || ""
      );
      const key = `${cell.rowIndex}-${cell.colIndex}`;
      originalValues.set(key, value);
    });
    return originalValues;
  }, [tableData, selectedCells]);

  const originalValues = useMemo(
    () => getOriginalValuesForCitations(),
    [getOriginalValuesForCitations]
  );

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

  const searchForCitations = useCallback(async () => {
    if (selectedCells.length === 0 || !tableData) return;

    setHasStartedSearch(true);
    setIsLoading(true);
    setError(null);
    setCitations([]);
    setSearchContext(null);

    if (isDebugEnabled) {
      outputDebugTestCase(
        tableData,
        headers,
        selectedCellsData,
        documentTitle,
        documentDescription
      );
    }

    try {
      const result = await findCitations(
        tableData,
        headers,
        selectedCellsData,
        documentTitle,
        documentDescription
      );

      if (result.error) {
        setError(result.error);
      } else if (result.citations) {
        // Add IDs to citations and process them
        const citationsWithIds: Citation[] = result.citations.map(
          (citation, index) => ({
            ...citation,
            id: `citation-${index}`,
          })
        );
        setCitations(citationsWithIds);
        if (result.searchContext) {
          setSearchContext(result.searchContext);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to find citations");
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedCells,
    tableData,
    isDebugEnabled,
    headers,
    selectedCellsData,
    documentTitle,
    documentDescription,
  ]);

  // Reset search state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setHasStartedSearch(false);
      setCitations([]);
      setSelectedCitationIds(new Set());
      setError(null);
      setSearchContext(null);
    }
  }, [isOpen]);

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
        className="max-w-2xl max-h-[80vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Find Citations for {cellCount} Selected {cellText}
          </DialogTitle>
          <DialogDescription>
            Review and select citations to lock with your data.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          {!hasStartedSearch ? (
            <div className="text-center py-8 space-y-6">
              {/* Selected cells preview */}
              {selectedCells.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-medium">
                    Selected Data Preview:
                  </h4>
                  <div className="text-xs text-muted-foreground space-y-2">
                    {getSelectedCellsPreview().map((cell, index) => (
                      <div
                        key={index}
                        className="bg-background rounded px-2 py-1"
                      >
                        <span className="font-medium text-foreground">
                          {cell.header}:
                        </span>{" "}
                        <span className="text-foreground">
                          {String(cell.value || "(empty)")}
                        </span>
                        <span className="text-muted-foreground/70 ml-2 text-xs">
                          (Row {cell.row}, Col {cell.col})
                        </span>
                      </div>
                    ))}
                    {selectedCells.length > 5 && (
                      <div className="italic text-center pt-1">
                        ...and {selectedCells.length - 5} more cells
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  This process typically takes about 30 seconds.
                </p>
                <Button
                  onClick={searchForCitations}
                  className="flex items-center gap-2"
                  size="lg"
                >
                  <Search className="h-4 w-4" />
                  Find Citations
                </Button>
              </div>
            </div>
          ) : isLoading ? (
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
              <Button onClick={searchForCitations} variant="outline" size="sm">
                Try Again
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Search context summary */}
              {searchContext && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <h4 className="text-sm font-medium mb-2">Search Summary:</h4>
                  <p className="text-xs text-muted-foreground">
                    {searchContext}
                  </p>
                </div>
              )}

              {/* Citations list */}
              {citations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No citations found. Try selecting different cells or refining
                  your data.
                </div>
              ) : (
                <div className="space-y-4">
                  {citations.map((citation) => {
                    // Find the original value this citation corresponds to
                    const originalValue = citation.citedValue
                      ? Array.from(originalValues.values()).find(
                          (val) =>
                            val
                              .toLowerCase()
                              .includes(
                                citation.citedValue?.toLowerCase() || ""
                              ) ||
                            citation.citedValue
                              ?.toLowerCase()
                              .includes(val.toLowerCase() || "")
                        )
                      : undefined;

                    return (
                      <div
                        key={citation.id}
                        className="border rounded-lg p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => handleCitationToggle(citation.id)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id={`citation-${citation.id}`}
                            checked={selectedCitationIds.has(citation.id)}
                            onCheckedChange={() =>
                              handleCitationToggle(citation.id)
                            }
                            className="mt-1 pointer-events-none"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm mb-1">
                              {citation.title}
                            </h4>
                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                              {citation.snippet}
                            </p>

                            {/* Show original vs cited values */}
                            {citation.citedValue && (
                              <div className="space-y-1 mb-3 p-2 bg-muted/20 rounded">
                                {originalValue &&
                                  originalValue !== citation.citedValue && (
                                    <div className="text-xs">
                                      <span className="text-muted-foreground">
                                        Original:
                                      </span>{" "}
                                      <span className="line-through text-muted-foreground/70">
                                        &ldquo;{originalValue}&rdquo;
                                      </span>
                                    </div>
                                  )}
                                <div className="text-xs">
                                  <span className="text-muted-foreground">
                                    Cited:
                                  </span>{" "}
                                  <span className="text-primary font-medium">
                                    &ldquo;{citation.citedValue}&rdquo;
                                  </span>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{getDomainFromUrl(citation.url)}</span>
                              <a
                                href={citation.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center hover:text-foreground transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View source
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
