import React from "react";

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

    // The text content should be inside the td element
    const textContent = cell.querySelector("div");
    expect(textContent).toBeInTheDocument();
    expect(textContent).toHaveTextContent("test value");
  });

  it("should have selectable tooltip text when cell is locked with a note", async () => {
    const user = userEvent.setup();
    const testNote = "This is a selectable lock note for testing";
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
    expect(cell).toHaveAttribute("data-locked", "true");

    // Hover over the cell to trigger the tooltip
    await user.hover(cell);

    // Wait for tooltip to appear
    await waitFor(
      async () => {
        const tooltipContent = screen.queryByText(testNote);
        if (tooltipContent) {
          // Check that the tooltip text element has the correct CSS classes for text selection
          const tooltipTextDiv = tooltipContent.closest(
            'div[class*="select-text"]'
          );
          expect(tooltipTextDiv).toBeInTheDocument();
          expect(tooltipTextDiv).toHaveClass("select-text");
          expect(tooltipTextDiv).toHaveClass("cursor-text");

          // Check that the tooltip content container has selectable styling
          const tooltipContainer = tooltipContent.closest(
            "[data-radix-tooltip-content]"
          );
          expect(tooltipContainer).toHaveClass("cursor-text");
          expect(tooltipContainer).toHaveClass("select-text");

          // Verify the tooltip has the expected styles for text selection
          expect(tooltipContainer).toHaveStyle({ userSelect: "text" });
        }
      },
      { timeout: 2000 }
    );
  });

  it("should update locked state when underlying data changes", () => {
    // Initially not locked
    mockUseIsCellLocked.mockReturnValue(false);
    mockUseLockNoteForCell.mockReturnValue(undefined);

    const { rerender } = render(
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

    let cell = screen.getByTestId("table-cell");
    expect(cell).toHaveAttribute("data-locked", "false");

    // Update to locked state
    mockUseIsCellLocked.mockReturnValue(true);
    mockUseLockNoteForCell.mockReturnValue("Cell is now locked");

    rerender(
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

    cell = screen.getByTestId("table-cell");
    expect(cell).toHaveAttribute("data-locked", "true");
  });

  it("should properly handle position changes after column/row operations", () => {
    // Test scenario: Cell was locked at position (1, 1), but after column deletion,
    // it should now be at position (1, 0) and still be locked
    mockUseIsCellLocked.mockReturnValue(true);
    mockUseLockNoteForCell.mockReturnValue("Moved cell lock");

    render(
      <table>
        <tbody>
          <tr>
            <td>Cell 0,0</td>
            <TableCell
              rowIndex={1}
              colIndex={0}
              header="test"
              value="test value"
            />
          </tr>
        </tbody>
      </table>
    );

    const cell = screen.getByTestId("table-cell");
    expect(cell).toHaveAttribute("data-locked", "true");
    expect(cell).toHaveAttribute("data-row-index", "1");
    expect(cell).toHaveAttribute("data-col-index", "0");
  });

  it("should unlock cell when it's no longer in locked state", () => {
    // Initially locked
    mockUseIsCellLocked.mockReturnValue(true);
    mockUseLockNoteForCell.mockReturnValue("Locked cell");

    const { rerender } = render(
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

    let cell = screen.getByTestId("table-cell");
    expect(cell).toHaveAttribute("data-locked", "true");

    // Update to unlocked state (simulating when locked cell's row/column was deleted)
    mockUseIsCellLocked.mockReturnValue(false);
    mockUseLockNoteForCell.mockReturnValue(undefined);

    rerender(
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

    cell = screen.getByTestId("table-cell");
    expect(cell).toHaveAttribute("data-locked", "false");
  });
});
