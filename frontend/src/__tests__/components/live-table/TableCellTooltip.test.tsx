import React from "react";

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { render, screen } from "@testing-library/react";

import TableCell from "@/components/live-table/TableCell";

const mockUseIsCellLocked = vi.fn();
const mockUseLockNoteForCell = vi.fn();
const mockUseEditingCell = vi.fn();
const mockUseHandleCellChange = vi.fn();
const mockUseSetEditingCell = vi.fn();
const mockUseSelectionStartOrMove = vi.fn();
const mockUseSelectIsCellInSelection = vi.fn();
const mockUseSelectIsCellSelected = vi.fn();
const mockUseFirstUserColorForCell = vi.fn();
const mockUseHasOtherUserCursors = vi.fn();

vi.mock("@/stores/dataStore", () => ({
  useIsCellLocked: () => mockUseIsCellLocked(),
  useLockNoteForCell: () => mockUseLockNoteForCell(),
  useEditingCell: () => mockUseEditingCell(),
  useHandleCellChange: () => mockUseHandleCellChange(),
  useSetEditingCell: () => mockUseSetEditingCell(),
}));

vi.mock("@/stores/selectionStore", () => ({
  useSelectionStartOrMove: () => mockUseSelectionStartOrMove(),
  useSelectIsCellInSelection: () => mockUseSelectIsCellInSelection(),
  useSelectIsCellSelected: () => mockUseSelectIsCellSelected(),
}));

vi.mock("@/stores/awareness-store", () => ({
  useFirstUserColorForCell: () => mockUseFirstUserColorForCell(),
  useHasOtherUserCursors: () => mockUseHasOtherUserCursors(),
}));

describe("TableCell Tooltip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEditingCell.mockReturnValue(null);
    mockUseHandleCellChange.mockReturnValue(vi.fn());
    mockUseSetEditingCell.mockReturnValue(vi.fn());
    mockUseSelectionStartOrMove.mockReturnValue(vi.fn());
    mockUseSelectIsCellInSelection.mockReturnValue(false);
    mockUseSelectIsCellSelected.mockReturnValue(false);
    mockUseFirstUserColorForCell.mockReturnValue(null);
    mockUseHasOtherUserCursors.mockReturnValue(false);
  });

  it("should not render tooltip when cell is not locked", () => {
    mockUseIsCellLocked.mockReturnValue(false);
    mockUseLockNoteForCell.mockReturnValue(undefined);

    render(
      <table>
        <tbody>
          <tr>
            <TableCell
              rowIndex={0}
              colIndex={0}
              header="test"
              value="test value"
            />
          </tr>
        </tbody>
      </table>
    );

    const cell = screen.getByTestId("table-cell");
    expect(cell).toBeInTheDocument();
    expect(cell).toHaveAttribute("data-locked", "false");
  });

  it("should not render tooltip when cell is locked but has no note", () => {
    mockUseIsCellLocked.mockReturnValue(true);
    mockUseLockNoteForCell.mockReturnValue(undefined);

    render(
      <table>
        <tbody>
          <tr>
            <TableCell
              rowIndex={0}
              colIndex={0}
              header="test"
              value="test value"
            />
          </tr>
        </tbody>
      </table>
    );

    const cell = screen.getByTestId("table-cell");
    expect(cell).toBeInTheDocument();
    expect(cell).toHaveAttribute("data-locked", "true");
  });

  it("should render tooltip when cell is locked and has a note", () => {
    mockUseIsCellLocked.mockReturnValue(true);
    mockUseLockNoteForCell.mockReturnValue("This cell is locked for testing");

    render(
      <table>
        <tbody>
          <tr>
            <TableCell
              rowIndex={0}
              colIndex={0}
              header="test"
              value="test value"
            />
          </tr>
        </tbody>
      </table>
    );

    const cell = screen.getByTestId("table-cell");
    expect(cell).toBeInTheDocument();
    expect(cell).toHaveAttribute("data-locked", "true");
  });

  it("should render tooltip with correct note text when cell is locked", () => {
    const testNote = "This is a test lock note";
    mockUseIsCellLocked.mockReturnValue(true);
    mockUseLockNoteForCell.mockReturnValue(testNote);

    render(
      <table>
        <tbody>
          <tr>
            <TableCell
              rowIndex={0}
              colIndex={0}
              header="test"
              value="test value"
            />
          </tr>
        </tbody>
      </table>
    );

    const cell = screen.getByTestId("table-cell");
    expect(cell).toBeInTheDocument();
    expect(cell).toHaveAttribute("data-locked", "true");
  });

  it("should have valid HTML structure with tooltip inside td element", () => {
    const testNote = "Test lock note";
    mockUseIsCellLocked.mockReturnValue(true);
    mockUseLockNoteForCell.mockReturnValue(testNote);

    render(
      <table>
        <tbody>
          <tr>
            <TableCell
              rowIndex={0}
              colIndex={0}
              header="test"
              value="test value"
            />
          </tr>
        </tbody>
      </table>
    );

    const cell = screen.getByTestId("table-cell");
    expect(cell.tagName).toBe("TD");

    // The input should be inside the td element
    const input = cell.querySelector("input");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("test value");
  });
});
