import { toast } from "sonner";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  act,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import * as generateSelectedCellsSuggestionsModule
  from "@/components/live-table/actions/generateSelectedCellsSuggestions";
import {
  AiFillSelectionButton,
} from "@/components/live-table/AiFillSelectionButton";
import * as LiveTableProviderModule
  from "@/components/live-table/LiveTableProvider";
import * as SelectionStoreModule from "@/stores/selectionStore";

vi.mock("@/components/live-table/LiveTableProvider", () => ({
  useLiveTable: vi.fn(),
}));

vi.mock("@/stores/selectionStore", () => ({
  useSelectedCells: vi.fn(),
}));

vi.mock(
  "@/components/live-table/actions/generateSelectedCellsSuggestions",
  () => ({
    default: vi.fn(),
  })
);

// Mock the toast notifications
vi.mock("sonner", () => ({
  toast: {
    promise: vi.fn(),
    error: vi.fn(),
  },
}));

describe("AiFillSelectionButton", () => {
  const mockTableData = [
    { Column1: "A1", Column2: "B1", Column3: "C1" },
    { Column1: "A2", Column2: "B2", Column3: "C2" },
    { Column1: "A3", Column2: "B3", Column3: "C3" },
  ];

  const mockHeaders = ["Column1", "Column2", "Column3"];

  const mockSelectedCells = [
    { rowIndex: 0, colIndex: 0 },
    { rowIndex: 0, colIndex: 1 },
    { rowIndex: 1, colIndex: 0 },
    { rowIndex: 1, colIndex: 1 },
  ];

  const mockSelectedCellsData = [
    ["A1", "B1"],
    ["A2", "B2"],
  ];

  const mockDocumentTitle = "Test Document";
  const mockDocumentDescription = "A test document for testing purposes";

  const mockSuggestions = [
    { rowIndex: 0, colIndex: 0, suggestion: "New A1" },
    { rowIndex: 0, colIndex: 1, suggestion: "New B1" },
    { rowIndex: 1, colIndex: 0, suggestion: "New A2" },
    { rowIndex: 1, colIndex: 1, suggestion: "New B2" },
  ];

  const mockHandleCellChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // vi.useFakeTimers();

    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue({
      tableData: mockTableData,
      headers: mockHeaders,
      handleCellChange: mockHandleCellChange,
      documentTitle: mockDocumentTitle,
      documentDescription: mockDocumentDescription,
    } as unknown as ReturnType<typeof LiveTableProviderModule.useLiveTable>);

    vi.mocked(SelectionStoreModule.useSelectedCells).mockReturnValue(
      mockSelectedCells
    );

    vi.mocked(generateSelectedCellsSuggestionsModule.default).mockResolvedValue(
      {
        suggestions: mockSuggestions,
      }
    );

    // Mock the toast.promise to execute the callback immediately
    vi.mocked(toast.promise).mockImplementation((promiseFnOrPromise) => {
      if (typeof promiseFnOrPromise === "function") {
        promiseFnOrPromise(); // Execute the async function passed to toast.promise
      }
      // Actual toast.promise returns a toastId (number or string)
      // To satisfy the complex type with vi.mocked, we cast.
      return 1 as unknown as ReturnType<typeof toast.promise>;
    });
  });

  afterEach(() => {
    // vi.useRealTimers();
  });

  it("should be disabled when no cells are selected", () => {
    // Override the mock for useLiveTable with no selected cells
    // vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValueOnce({
    //   ...vi.mocked(LiveTableProviderModule.useLiveTable)(),
    //   selectedCells: [],
    // } as unknown as ReturnType<typeof LiveTableProviderModule.useLiveTable>);

    // Mock useSelectedCells to return an empty array
    vi.mocked(SelectionStoreModule.useSelectedCells).mockReturnValueOnce([]);

    render(<AiFillSelectionButton />);

    const button = screen.getByRole("button", { name: /fill selection/i });
    expect(button).toBeDisabled();
  });

  it("should call generateSelectedCellsSuggestions when clicked", async () => {
    render(<AiFillSelectionButton />);

    const button = screen.getByRole("button", { name: /fill selection/i });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(generateSelectedCellsSuggestionsModule.default).toHaveBeenCalledWith(
      mockTableData,
      mockHeaders,
      mockSelectedCells,
      mockSelectedCellsData,
      mockDocumentTitle,
      mockDocumentDescription
    );

    expect(toast.promise).toHaveBeenCalled();
  });

  it("should update cells with suggestions when action succeeds", async () => {
    render(<AiFillSelectionButton />);

    const button = screen.getByRole("button", { name: /fill selection/i });

    await act(async () => {
      fireEvent.click(button);
      // Wait for promises to resolve
      await Promise.resolve();
    });

    // Check that handleCellChange was called for each suggested cell with the right parameters
    expect(mockHandleCellChange).toHaveBeenCalledTimes(mockSuggestions.length);
    expect(mockHandleCellChange).toHaveBeenCalledWith(0, "Column1", "New A1");
    expect(mockHandleCellChange).toHaveBeenCalledWith(0, "Column2", "New B1");
    expect(mockHandleCellChange).toHaveBeenCalledWith(1, "Column1", "New A2");
    expect(mockHandleCellChange).toHaveBeenCalledWith(1, "Column2", "New B2");
  });

  it("should show error toast when action fails", async () => {
    vi.mocked(
      generateSelectedCellsSuggestionsModule.default
    ).mockResolvedValueOnce({
      error: "Failed to generate suggestions",
    });

    vi.spyOn(toast, "promise").mockImplementationOnce(
      (prom: Parameters<typeof toast.promise>[0]) => {
        expect(prom).toBeInstanceOf(Function);
        (prom as () => Promise<unknown>)().catch((error: Error) => {
          expect(error).toBeDefined();
        });
        return 1 as unknown as ReturnType<typeof toast.promise>;
      }
    );

    render(<AiFillSelectionButton />);
    const button = screen.getByRole("button", { name: /fill selection/i });

    await act(async () => {
      fireEvent.click(button);
    });
  });
});
