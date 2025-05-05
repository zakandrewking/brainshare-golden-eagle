import * as Y from "yjs";
import { UndoManager } from "yjs";

import { TooltipProvider } from "@/components/ui/tooltip";

import LiveTable, { CursorDataForCell } from "./LiveTable";
import LiveTableToolbar from "./LiveTableToolbar";

interface LiveTableContainerProps {
  /** The header labels for the table columns. */
  headers: string[];
  /** The data rows to display in the table. */
  tableData: Record<string, unknown>[];
  /** The currently selected cell coordinates (row and column index), or null if none. */
  selectedCell: { rowIndex: number; colIndex: number } | null;
  /** The index of the header currently being edited, or null if none. */
  editingHeaderIndex: number | null;
  /** The current value of the header being edited. */
  editingHeaderValue: string;
  /** The color associated with the current user for highlighting their selection. */
  selfColor: string | undefined;
  /** Pre-computed cursor data for each cell containing active cursors. */
  cursorsData: CursorDataForCell[];
  /** Callback triggered when a cell's value changes. */
  onCellChange: (rowIndex: number, header: string, newValue: string) => void;
  /** Callback triggered when a cell gains focus. */
  onCellFocus: (rowIndex: number, colIndex: number) => void;
  /** Callback triggered when a cell loses focus. */
  onCellBlur: () => void;
  /** Callback triggered when a table header is double-clicked. */
  onHeaderDoubleClick: (colIndex: number) => void;
  /** Callback triggered when the value of an editing header changes. */
  onHeaderChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Callback triggered when an editing header loses focus. */
  onHeaderBlur: () => void;
  /** Callback triggered on key down event within an editing header input. */
  onHeaderKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  yTableRef: React.RefObject<Y.Array<Y.Map<unknown>> | null>;
  yDocRef: React.RefObject<Y.Doc | null>;
  yHeadersRef: React.RefObject<Y.Array<string> | null>;
  isTableLoaded: boolean;
  undoManager: UndoManager | null;
}

export const LiveTableContainer = ({
  cursorsData,
  editingHeaderIndex,
  editingHeaderValue,
  headers,
  isTableLoaded,
  onCellBlur,
  onCellChange,
  onCellFocus,
  onHeaderBlur,
  onHeaderChange,
  onHeaderDoubleClick,
  onHeaderKeyDown,
  selectedCell,
  selfColor,
  tableData,
  undoManager,
  yDocRef,
  yHeadersRef,
  yTableRef,
}: LiveTableContainerProps) => {
  return (
    <div className="fixed flex flex-col bottom-0 left-0 right-0 h-[calc(100vh-250px)] p-1 z-10 bg-background">
      <TooltipProvider delayDuration={0}>
        <LiveTableToolbar
          headers={headers}
          isTableLoaded={isTableLoaded}
          selectedCell={selectedCell}
          undoManager={undoManager}
          yDocRef={yDocRef}
          yHeadersRef={yHeadersRef}
          yTableRef={yTableRef}
        />
        <div className="flex-grow overflow-scroll">
          <LiveTable
            cursorsData={cursorsData}
            editingHeaderIndex={editingHeaderIndex}
            editingHeaderValue={editingHeaderValue}
            headers={headers}
            onCellBlur={onCellBlur}
            onCellChange={onCellChange}
            onCellFocus={onCellFocus}
            onHeaderBlur={onHeaderBlur}
            onHeaderChange={onHeaderChange}
            onHeaderDoubleClick={onHeaderDoubleClick}
            onHeaderKeyDown={onHeaderKeyDown}
            selectedCell={selectedCell}
            selfColor={selfColor}
            tableData={tableData}
          />
        </div>
      </TooltipProvider>
    </div>
  );
};
