import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import LiveTableDisplay from "@/components/live-table/LiveTableDisplay";
import { useHeaders, useIsTableLoaded, useTableData } from "@/stores/dataStore";
import { useSetSelectionRange } from "@/stores/selectionStore";
import { TestDataStoreWrapper } from "./data-store-test-utils";

vi.mock("@/stores/dataStore", async (importOriginal) => ({
  ...(await importOriginal()),
  useIsTableLoaded: vi.fn(),
  useHeaders: vi.fn(),
  useTableData: vi.fn(),
}));

vi.mock("@/stores/selectionStore", async (importOriginal) => ({
  ...(await importOriginal()),
  useSetSelectionRange: vi.fn(),
}));

describe("LiveTableDisplay - Header Click Selection", () => {
  const headers = ["A", "B"];
  const data = [
    { A: "1", B: "2" },
    { A: "3", B: "4" },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useIsTableLoaded).mockReturnValue(true);
    vi.mocked(useHeaders).mockReturnValue(headers);
    vi.mocked(useTableData).mockReturnValue(data);
  });

  it("selects entire column when header clicked", () => {
    const mockSetRange = vi.fn();
    vi.mocked(useSetSelectionRange).mockReturnValue(mockSetRange);

    render(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    const headerEl = screen.getByText("A").closest("th") as HTMLElement;
    fireEvent.click(headerEl);

    expect(mockSetRange).toHaveBeenCalledWith(
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: data.length - 1, colIndex: 0 }
    );
  });

  it("selects entire row when row header clicked", () => {
    const mockSetRange = vi.fn();
    vi.mocked(useSetSelectionRange).mockReturnValue(mockSetRange);

    render(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    const rowHeader = screen.getAllByTestId("row-number")[1];
    fireEvent.click(rowHeader);

    expect(mockSetRange).toHaveBeenCalledWith(
      { rowIndex: 1, colIndex: 0 },
      { rowIndex: 1, colIndex: headers.length - 1 }
    );
  });
});
