import { toast } from "sonner";
import type { MockedFunction } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import * as ActionsModule from "@/components/live-table/actions";
import AiFillColumnButton from "@/components/live-table/AiFillColumnButton";

vi.mock("@/components/live-table/actions", () => ({
  generateColumnSuggestions: vi.fn(),
}));
const mockGenerateColumnSuggestions =
  ActionsModule.generateColumnSuggestions as MockedFunction<
    typeof ActionsModule.generateColumnSuggestions
  >;

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("AiFillColumnButton", () => {
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
      <AiFillColumnButton
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
      <AiFillColumnButton
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
      <AiFillColumnButton
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
    expect(screen.queryByText("Confirm AI Column Fill")).toBeTruthy();
    expect(screen.queryByText("Confirm & Generate")).toBeTruthy();
    expect(screen.queryByText("Cancel")).toBeTruthy();
  });

  it("calls generateColumnSuggestions and updates table when confirmed", async () => {
    // Mock successful suggestions
    mockGenerateColumnSuggestions.mockResolvedValueOnce({
      suggestions: [
        { index: 0, suggestion: "New York" },
        { index: 1, suggestion: "Boston" },
      ],
    });

    render(
      <AiFillColumnButton
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

    expect(mockGenerateColumnSuggestions).toHaveBeenCalledWith(
      expect.anything(),
      ["Name", "Age", "City"],
      2
    );

    await waitFor(() => {
      // Verify a success toast was shown
      expect(toast.success).toHaveBeenCalledWith(
        'Column "City" updated with AI suggestions.'
      );
    });
  });

  it("shows error toast when API returns an error", async () => {
    // Mock error response
    mockGenerateColumnSuggestions.mockResolvedValueOnce({
      error: "API error",
    });

    render(
      <AiFillColumnButton
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
    mockGenerateColumnSuggestions.mockResolvedValueOnce({
      suggestions: [],
    });

    render(
      <AiFillColumnButton
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
        'AI returned no suggestions for column "City".'
      );
    });
  });
});
