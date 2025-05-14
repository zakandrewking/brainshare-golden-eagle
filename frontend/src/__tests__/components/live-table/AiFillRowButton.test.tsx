import { toast } from "sonner";
import type { MockedFunction } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import * as ActionsModule from "@/components/live-table/actions";
import AiFillRowButton from "@/components/live-table/AiFillRowButton";

vi.mock("@/components/live-table/actions", () => ({
  generateRowSuggestions: vi.fn(),
}));
const mockGenerateRowSuggestions =
  ActionsModule.generateRowSuggestions as MockedFunction<
    typeof ActionsModule.generateRowSuggestions
  >;

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("AiFillRowButton", () => {
  let mockYDoc: Y.Doc;
  let mockYHeaders: Y.Array<string>;
  let mockYTable: Y.Array<Y.Map<unknown>>;
  let mockSelectedCell: { rowIndex: number; colIndex: number };

  beforeEach(() => {
    vi.clearAllMocks();

    mockYDoc = new Y.Doc();
    mockYHeaders = mockYDoc.getArray<string>("headers");
    mockYTable = mockYDoc.getArray<Y.Map<unknown>>("table");
    mockSelectedCell = { rowIndex: 1, colIndex: 2 };

    mockYHeaders.push(["Name", "Age", "City"]);

    const row1 = new Y.Map();
    row1.set("Name", "Alice");
    row1.set("Age", "30");
    row1.set("City", "New York");

    const row2 = new Y.Map();
    row2.set("Name", "Bob");
    row2.set("Age", "25");
    row2.set("City", "Boston");

    mockYTable.push([row1, row2]);
  });

  it("renders with correct disabled state", () => {
    const { rerender } = render(
      <AiFillRowButton
        isDisabled={false}
        selectedCell={mockSelectedCell}
        yDoc={mockYDoc}
        yTable={mockYTable}
        yHeaders={mockYHeaders}
        withTooltipProvider={true}
      />
    );

    const button = screen.getByRole("button");
    expect(button.getAttribute("disabled")).toBeFalsy();

    // Test disabled by re-rendering
    rerender(
      <AiFillRowButton
        isDisabled={true}
        selectedCell={mockSelectedCell}
        yDoc={mockYDoc}
        yTable={mockYTable}
        yHeaders={mockYHeaders}
        withTooltipProvider={true}
      />
    );

    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("opens confirmation dialog when button is clicked", () => {
    render(
      <AiFillRowButton
        isDisabled={false}
        selectedCell={mockSelectedCell}
        yDoc={mockYDoc}
        yTable={mockYTable}
        yHeaders={mockYHeaders}
        withTooltipProvider={true}
      />
    );

    fireEvent.mouseDown(screen.getByRole("button"));

    // Confirm dialog elements are in the document
    expect(screen.queryByText("Confirm AI Row Fill")).toBeTruthy();
    expect(screen.queryByText("Confirm & Generate")).toBeTruthy();
    expect(screen.queryByText("Cancel")).toBeTruthy();
  });

  it("calls generateRowSuggestions and updates table when confirmed", async () => {
    // Mock successful suggestions
    mockGenerateRowSuggestions.mockResolvedValueOnce({
      suggestions: [
        { header: "Name", suggestion: "Charlie" },
        { header: "Age", suggestion: "35" },
        { header: "City", suggestion: "Chicago" },
      ],
    });

    render(
      <AiFillRowButton
        isDisabled={false}
        selectedCell={mockSelectedCell}
        yDoc={mockYDoc}
        yTable={mockYTable}
        yHeaders={mockYHeaders}
        withTooltipProvider={true}
      />
    );

    fireEvent.mouseDown(screen.getByRole("button"));

    fireEvent.click(screen.getByText("Confirm & Generate"));

    expect(mockGenerateRowSuggestions).toHaveBeenCalledWith(
      expect.anything(),
      ["Name", "Age", "City"],
      1
    );

    await waitFor(() => {
      // Verify a success toast was shown
      expect(toast.success).toHaveBeenCalledWith(
        "Row 2 updated with AI suggestions."
      );
    });

    // Verify the row was updated in the Y.Doc
    const updatedRow = mockYTable.get(1);
    expect(updatedRow.get("Name")).toBe("Charlie");
    expect(updatedRow.get("Age")).toBe("35");
    expect(updatedRow.get("City")).toBe("Chicago");
  });

  it("shows error toast when API returns an error", async () => {
    // Mock error response
    mockGenerateRowSuggestions.mockResolvedValueOnce({
      error: "API error",
    });

    render(
      <AiFillRowButton
        isDisabled={false}
        selectedCell={mockSelectedCell}
        yDoc={mockYDoc}
        yTable={mockYTable}
        yHeaders={mockYHeaders}
        withTooltipProvider={true}
      />
    );

    fireEvent.mouseDown(screen.getByRole("button"));
    fireEvent.click(screen.getByText("Confirm & Generate"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("AI Fill Error: API error");
    });
  });

  it("shows warning toast when API returns no suggestions", async () => {
    // Mock empty suggestions
    mockGenerateRowSuggestions.mockResolvedValueOnce({
      suggestions: [],
    });

    render(
      <AiFillRowButton
        isDisabled={false}
        selectedCell={mockSelectedCell}
        yDoc={mockYDoc}
        yTable={mockYTable}
        yHeaders={mockYHeaders}
        withTooltipProvider={true}
      />
    );

    fireEvent.mouseDown(screen.getByRole("button"));
    fireEvent.click(screen.getByText("Confirm & Generate"));

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(
        "AI returned no suggestions for row 2."
      );
    });
  });

  it("handles missing row gracefully", async () => {
    mockGenerateRowSuggestions.mockResolvedValueOnce({
      suggestions: [
        { header: "Name", suggestion: "Charlie" },
        { header: "Age", suggestion: "35" },
        { header: "City", suggestion: "Chicago" },
      ],
    });

    // Set a selected cell with an invalid row index
    const invalidSelectedCell = { rowIndex: 99, colIndex: 2 };

    render(
      <AiFillRowButton
        isDisabled={false}
        selectedCell={invalidSelectedCell}
        yDoc={mockYDoc}
        yTable={mockYTable}
        yHeaders={mockYHeaders}
        withTooltipProvider={true}
      />
    );

    fireEvent.mouseDown(screen.getByRole("button"));
    fireEvent.click(screen.getByText("Confirm & Generate"));

    await waitFor(() => {
      // Success would be called after the suggestions are processed,
      // but since the row doesn't exist, we should see a console warning
      // We can't easily test console.warn, but we can check that
      // the toast.success is not called, indicating the operation failed quietly
      expect(toast.success).not.toHaveBeenCalled();
    });
  });
});
