# Project Plan: Lock with Note

This document outlines the plan to implement a "Lock with Note" feature. This will allow users to lock a selection of cells and attach a textual note explaining the reason for the lock.

## 1. Data Layer (`LiveTableDoc.ts`)

-   **Goal**: Update the underlying data structure to support storing a note with each lock range.
-   **Tasks**:
    *   Modify the `LockRange` interface in `frontend/src/components/live-table/LiveTableDoc.ts` to include an optional `note?: string` field.
    *   Update the `lockCellRange` method in `LiveTableDoc.ts` to accept an optional `note` parameter and save it to the `LockRange` object.
    *   Update `lockedCellsUpdateCallback` to pass a `Map<string, string | undefined>` where the key is the cell coordinate (`rowIndex-colIndex`) and the value is the lock note.
    *   Update `updateLockedCellsState` to populate the map with notes.
-   **Status**: Complete. Tests have also been updated.

## 2. State Management (`dataStore.tsx`)

-   **Goal**: Adapt the Zustand store to manage the state of locked cells with their notes.
-   **Tasks**:
    *   In `frontend/src/stores/dataStore.tsx`, change the `lockedCells` state from `Set<string>` to `Map<string, string | undefined>`. The key will be the cell coordinate string (`'${rowIndex}-${colIndex}'`), and the value will be the lock note (or `undefined` if no note).
    *   Update the `lockSelectedRange` action in `dataStore.tsx` to accept an optional `note` and pass it to `liveTableDoc.lockCellRange`.
    *   Create a new hook `useLockNoteForCell(rowIndex: number, colIndex: number)` that returns the note for a given cell, if it exists.
    *   Update the `handleLockedCellsUpdate` listener to correctly handle the incoming `Map` from `LiveTableDoc`.
    *   Update `useIsCellLocked` and `useIsCellLockedFn` to work with the new
        `Map` structure (i.e., use `lockedCells.has(...)`).

## 3. UI: Lock with Note Dialog

-   **Goal**: Create a user interface for entering the lock note.
-   **Tasks**:
    *   Create a new component `frontend/src/components/live-table/LockWithNoteDialog.tsx`.
    *   This component will be a dialog/modal (using `AlertDialog` or `Dialog` from `/components/ui`).
    *   It will contain a `Textarea` for the note and "Lock" and "Cancel" buttons.
    *   The dialog will be controlled by state within `LockButton.tsx`.

## 4. UI: Update `LockButton.tsx`

-   **Goal**: Integrate the new dialog and functionality into the existing lock button in the toolbar.
-   **Tasks**:
    *   In `frontend/src/components/live-table/LockButton.tsx`, add a new `DropdownMenuItem`: "Lock with Note...".
    *   Clicking this item will open the `LockWithNoteDialog`.
    *   Implement the logic to handle the submission from the dialog. On submission, it will call the `lockSelectedRange` action from `dataStore` with the selected cells and the note.

## 5. UI: Displaying the Note (`TableCell.tsx`)

-   **Goal**: Show the user that a cell is locked and display the note on hover.
-   **Tasks**:
    *   In `frontend/src/components/live-table/TableCell.tsx`, use the new `useLockNoteForCell` hook to get the note for the current cell.
    *   If a cell is locked and has a note, wrap the `<td>` element with a `Tooltip` component (from `/components/ui/tooltip.tsx`).
    *   The `TooltipContent` will display the lock note.

## 6. Testing

-   **Goal**: Ensure the new functionality is robust and doesn't introduce regressions.
-   **Tasks**:
    *   Update existing tests for `LiveTableDoc.ts` to cover notes. (**Done**)
    *   Update tests for `dataStore.tsx` to reflect the change from `Set` to `Map` for `lockedCells` and test the new hook.
    *   Create new tests for `LockWithNoteDialog.tsx`.
    *   Update tests for `LockButton.tsx` to cover the new dropdown item and dialog interaction.
    *   Update tests for `TableCell.tsx` to verify the tooltip appears with the correct note.
