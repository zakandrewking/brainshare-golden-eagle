import React from "react";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  useEditingHeaderIndexMock,
  useEditingHeaderIndexPush,
} from "@/__tests__/test-utils/useEditingHeaderIndex";
import {
  useEditingHeaderValueMock,
  useEditingHeaderValuePush,
} from "@/__tests__/test-utils/useEditingHeaderValue";
import LiveTableDisplay from "@/components/live-table/LiveTableDisplay";
import {
  type CellValue,
  type ColumnId,
  type RowId,
} from "@/components/live-table/LiveTableDoc";
import {
  useHandleHeaderBlur,
  useHandleHeaderChange,
  useHandleHeaderDoubleClick,
  useHeaders,
  useIsCellLocked,
  useIsTableLoaded,
  useTableData,
} from "@/stores/dataStore";

import { TestDataStoreWrapper } from "./data-store-test-utils";

vi.mock("@/stores/dataStore", async (importOriginal) => ({
  ...(await importOriginal()),
  useIsTableLoaded: vi.fn(),
  useHeaders: vi.fn(),
  useTableData: vi.fn(),
  useIsCellLocked: vi.fn(),
  useHandleHeaderDoubleClick: vi.fn(),
  useHandleHeaderChange: vi.fn(),
  useHandleHeaderBlur: vi.fn(),
  useEditingHeaderIndex: useEditingHeaderIndexMock,
  useEditingHeaderValue: useEditingHeaderValueMock,
}));

describe("LiveTableDisplay Header Editing", () => {
  const initialHeaders = ["Name", "Age"];

  const rowId1 = crypto.randomUUID() as RowId;
  const rowId2 = crypto.randomUUID() as RowId;
  const initialRowData: Record<RowId, Record<ColumnId, CellValue>> = {
    [rowId1]: { Name: "Alice", Age: "30" },
    [rowId2]: { Name: "Bob", Age: "24" },
  };

  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(useHeaders).mockReturnValue(initialHeaders);
    vi.mocked(useTableData).mockReturnValue(Object.values(initialRowData));
    vi.mocked(useIsTableLoaded).mockReturnValue(true);
    vi.mocked(useIsCellLocked).mockReturnValue(false);
    vi.mocked(useHandleHeaderDoubleClick).mockImplementation(() => () => {});
    vi.mocked(useHandleHeaderChange).mockImplementation(() => () => {});
    vi.mocked(useHandleHeaderBlur).mockImplementation(() => () => {});

    useEditingHeaderValuePush("");
    useEditingHeaderIndexPush(null);
  });

  it("should enter edit mode on header double-click and display input", async () => {
    const user = userEvent.setup();

    const mockHandleHeaderDoubleClick = vi.fn();
    vi.mocked(useHandleHeaderDoubleClick).mockImplementation(
      () => mockHandleHeaderDoubleClick
    );
    const mockHandleHeaderChange = vi.fn();
    vi.mocked(useHandleHeaderChange).mockImplementation(
      () => mockHandleHeaderChange
    );
    const mockHandleHeaderBlur = vi.fn();
    vi.mocked(useHandleHeaderBlur).mockImplementation(
      () => mockHandleHeaderBlur
    );

    render(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    const headerNameForTest = initialHeaders[0];

    const headerCellDiv = screen.getByText(headerNameForTest).closest("div");
    expect(headerCellDiv).toBeInTheDocument();
    await user.dblClick(headerCellDiv!);

    expect(mockHandleHeaderDoubleClick).toHaveBeenCalledWith(0);

    act(() => {
      useEditingHeaderValuePush(headerNameForTest);
      useEditingHeaderIndexPush(0);
    });

    const input = screen.getByTestId(
      `${headerNameForTest}-editing`
    ) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe(headerNameForTest);
  });

  it("should update header value on input change", async () => {
    const user = userEvent.setup();

    const mockHandleHeaderChange = vi.fn();
    vi.mocked(useHandleHeaderChange).mockImplementation(
      () => mockHandleHeaderChange
    );
    const mockHandleHeaderBlur = vi.fn();
    vi.mocked(useHandleHeaderBlur).mockImplementation(
      () => mockHandleHeaderBlur
    );

    render(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    const headerNameForTest = initialHeaders[0];

    const headerCellDiv = screen.getByText(headerNameForTest).closest("div");
    expect(headerCellDiv).toBeInTheDocument();
    await user.dblClick(headerCellDiv!);

    act(() => {
      useEditingHeaderValuePush(headerNameForTest);
      useEditingHeaderIndexPush(0);
    });

    const input = screen.getByTestId(
      `${headerNameForTest}-editing`
    ) as HTMLInputElement;
    const newHeaderText = "New Header Name";

    fireEvent.change(input, { target: { value: newHeaderText } });

    expect(mockHandleHeaderChange).toHaveBeenCalledWith(newHeaderText);

    await act(async () => {
      useEditingHeaderValuePush(newHeaderText);
    });

    expect(input.value).toBe(newHeaderText);
  });

  it("should save header changes on blur by calling liveTableDoc.editHeader", async () => {
    const user = userEvent.setup();

    const mockHandleHeaderBlur = vi.fn();
    vi.mocked(useHandleHeaderBlur).mockImplementation(
      () => mockHandleHeaderBlur
    );
    const mockHandleHeaderChange = vi.fn();
    vi.mocked(useHandleHeaderChange).mockImplementation(
      () => mockHandleHeaderChange
    );
    const mockHandleHeaderDoubleClick = vi.fn();
    vi.mocked(useHandleHeaderDoubleClick).mockImplementation(
      () => mockHandleHeaderDoubleClick
    );

    render(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    const headerIndexToEdit = 0;
    const headerNameForTest = initialHeaders[headerIndexToEdit];
    const newHeaderText = "Updated Name";

    const headerCellDiv = screen.getByText(headerNameForTest).closest("div");
    expect(headerCellDiv).toBeInTheDocument();

    await user.dblClick(headerCellDiv!);

    expect(mockHandleHeaderDoubleClick).toHaveBeenCalledWith(headerIndexToEdit);

    act(() => {
      useEditingHeaderValuePush(headerNameForTest);
      useEditingHeaderIndexPush(0);
    });

    const input = screen.getByTestId(
      `${headerNameForTest}-editing`
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { value: newHeaderText } });

    expect(mockHandleHeaderChange).toHaveBeenCalledWith(newHeaderText);

    fireEvent.blur(input);

    expect(mockHandleHeaderBlur).toHaveBeenCalled();
  });

  it("should save header changes on Enter key press by calling liveTableDoc.editHeader", async () => {
    const user = userEvent.setup();

    const mockHandleHeaderBlur = vi.fn();
    vi.mocked(useHandleHeaderBlur).mockImplementation(
      () => mockHandleHeaderBlur
    );
    const mockHandleHeaderChange = vi.fn();
    vi.mocked(useHandleHeaderChange).mockImplementation(
      () => mockHandleHeaderChange
    );
    const mockHandleHeaderDoubleClick = vi.fn();
    vi.mocked(useHandleHeaderDoubleClick).mockImplementation(
      () => mockHandleHeaderDoubleClick
    );

    render(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    const headerIndexToEdit = 0;
    const headerNameForTest = initialHeaders[headerIndexToEdit];
    const newHeaderText = "Confirmed Name";

    const headerCellDiv = screen.getByText(headerNameForTest).closest("div");
    expect(headerCellDiv).toBeInTheDocument();

    await user.dblClick(headerCellDiv!);

    expect(mockHandleHeaderDoubleClick).toHaveBeenCalledWith(headerIndexToEdit);

    act(() => {
      useEditingHeaderValuePush(headerNameForTest);
      useEditingHeaderIndexPush(0);
    });

    const input = screen.getByTestId(
      `${headerNameForTest}-editing`
    ) as HTMLInputElement;

    fireEvent.focus(input);

    fireEvent.change(input, { target: { value: newHeaderText } });

    expect(mockHandleHeaderChange).toHaveBeenCalledWith(newHeaderText);

    await user.keyboard("{Enter}");

    expect(mockHandleHeaderBlur).toHaveBeenCalled();
    expect(mockHandleHeaderChange).toHaveBeenCalledWith(newHeaderText);
  });

  it("should cancel header edit on Escape key press", async () => {
    const user = userEvent.setup();

    const mockHandleHeaderChange = vi.fn();
    vi.mocked(useHandleHeaderChange).mockImplementation(
      () => mockHandleHeaderChange
    );
    const mockHandleHeaderBlur = vi.fn();
    vi.mocked(useHandleHeaderBlur).mockImplementation(
      () => mockHandleHeaderBlur
    );

    render(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    const headerIndexToEdit = 0;
    const headerNameForTest = initialHeaders[headerIndexToEdit];

    const headerCellDiv = screen.getByText(headerNameForTest).closest("div");
    expect(headerCellDiv).toBeInTheDocument();

    await user.dblClick(headerCellDiv!);

    act(() => {
      useEditingHeaderValuePush(headerNameForTest);
      useEditingHeaderIndexPush(0);
    });

    const input = screen.getByTestId(
      `${headerNameForTest}-editing`
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { value: "Temporary Change" } });

    expect(mockHandleHeaderChange).toHaveBeenCalledWith("Temporary Change");

    await user.keyboard("{Escape}");

    expect(mockHandleHeaderChange).toHaveBeenCalledOnce();
    expect(mockHandleHeaderBlur).toHaveBeenCalled();
  });

  it("should enter edit mode on header double-tap (touch event) and display input", async () => {
    const mockHandleHeaderDoubleClick = vi.fn();
    vi.mocked(useHandleHeaderDoubleClick).mockImplementation(
      () => mockHandleHeaderDoubleClick
    );

    render(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    const headerNameForTest = initialHeaders[0];
    const headerCellDiv = screen.getByText(headerNameForTest).closest("div");
    expect(headerCellDiv).toBeInTheDocument();

    // Simulate double tap
    fireEvent.touchEnd(headerCellDiv!);
    await new Promise((resolve) => setTimeout(resolve, 50));
    fireEvent.touchEnd(headerCellDiv!);

    expect(mockHandleHeaderDoubleClick).toHaveBeenCalledWith(0);
  });
});
