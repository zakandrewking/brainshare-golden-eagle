import React from "react";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import * as Y from "yjs";

import {
  act,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  useEditingHeaderIndexMock,
  useEditingHeaderIndexPush,
} from "@/__tests__/test-utils/useEditingHeaderIndex";
import {
  useEditingHeaderValueMock,
  useEditingHeaderValuePush,
} from "@/__tests__/test-utils/useEditingHeaderValue";
import { DEFAULT_COL_WIDTH } from "@/components/live-table/config";
import LiveTableDisplay from "@/components/live-table/LiveTableDisplay";
import {
  type CellValue,
  type ColumnDefinition,
  type ColumnId,
  LiveTableDoc,
  type RowId,
} from "@/components/live-table/LiveTableDoc";
import { useLiveTable } from "@/components/live-table/LiveTableProvider";
import {
  useHandleHeaderBlur,
  useHandleHeaderChange,
  useHandleHeaderDoubleClick,
  useIsCellLocked,
} from "@/stores/dataStore";

import {
  getLiveTableMockValues,
  TestDataStoreWrapper,
} from "./liveTableTestUtils";

vi.mock(
  "@/components/live-table/LiveTableProvider",
  async (importOriginal) => ({
    ...(await importOriginal()),
    useLiveTable: vi.fn(),
  })
);

vi.mock("@/stores/dataStore", async (importOriginal) => ({
  ...(await importOriginal()),
  useIsCellLocked: vi.fn(),
  useHandleHeaderDoubleClick: vi.fn(),
  useHandleHeaderChange: vi.fn(),
  useHandleHeaderBlur: vi.fn(),
  useEditingHeaderIndex: useEditingHeaderIndexMock,
  useEditingHeaderValue: useEditingHeaderValueMock,
}));

describe("LiveTableDisplay Header Editing", () => {
  const colIdN = crypto.randomUUID() as ColumnId;
  const colIdA = crypto.randomUUID() as ColumnId;
  const initialColumnDefinitions: ColumnDefinition[] = [
    { id: colIdN, name: "Name", width: DEFAULT_COL_WIDTH },
    { id: colIdA, name: "Age", width: DEFAULT_COL_WIDTH },
  ];
  const initialColumnOrder: ColumnId[] = [colIdN, colIdA];

  const rowId1 = crypto.randomUUID() as RowId;
  const rowId2 = crypto.randomUUID() as RowId;
  const initialRowOrder: RowId[] = [rowId1, rowId2];
  const initialRowData: Record<RowId, Record<ColumnId, CellValue>> = {
    [rowId1]: { [colIdN]: "Alice", [colIdA]: "30" },
    [rowId2]: { [colIdN]: "Bob", [colIdA]: "24" },
  };

  let yDoc: Y.Doc;
  let liveTableDocInstance: LiveTableDoc;

  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(useIsCellLocked).mockImplementation(() => () => false);
    vi.mocked(useHandleHeaderDoubleClick).mockImplementation(() => () => {});
    vi.mocked(useHandleHeaderChange).mockImplementation(() => () => {});
    vi.mocked(useHandleHeaderBlur).mockImplementation(() => () => {});

    useEditingHeaderValuePush("");
    useEditingHeaderIndexPush(null);

    yDoc = new Y.Doc();
    liveTableDocInstance = new LiveTableDoc(yDoc);
    yDoc.transact(() => {
      initialColumnDefinitions.forEach((def) =>
        liveTableDocInstance.yColumnDefinitions.set(def.id, def)
      );
      liveTableDocInstance.yColumnOrder.push(initialColumnOrder);
      initialRowOrder.forEach((rId) => {
        const rData = initialRowData[rId];
        const yRowMap = new Y.Map<CellValue>();
        initialColumnOrder.forEach((cId) => {
          if (rData[cId] !== undefined) yRowMap.set(cId, rData[cId]);
        });
        liveTableDocInstance.yRowData.set(rId, yRowMap);
      });
      liveTableDocInstance.yRowOrder.push(initialRowOrder);
      liveTableDocInstance.yMeta.set("schemaVersion", 2);
    });

    vi.mocked(useLiveTable).mockImplementation(() => ({
      ...getLiveTableMockValues({
        liveTableDocInstance,
      }),
    }));
  });

  afterEach(() => {
    yDoc.destroy();
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
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    const headerNameForTest = initialColumnDefinitions[0].name;

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

  it("should enter edit mode on header double-tap and display input", async () => {
    vi.useFakeTimers();

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
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    const headerNameForTest = initialColumnDefinitions[0].name;

    const headerCellDiv = screen.getByText(headerNameForTest).closest("div")!;
    fireEvent.touchStart(headerCellDiv);
    vi.advanceTimersByTime(100);
    fireEvent.touchStart(headerCellDiv);
    vi.runAllTimers();

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
    vi.useRealTimers();
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
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    const headerNameForTest = initialColumnDefinitions[0].name; // "Name"

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
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    const headerIndexToEdit = 0;
    const headerNameForTest = initialColumnDefinitions[headerIndexToEdit].name;
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
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    const headerIndexToEdit = 0;
    const headerNameForTest = initialColumnDefinitions[headerIndexToEdit].name;
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
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    const headerIndexToEdit = 0;
    const headerNameForTest = initialColumnDefinitions[headerIndexToEdit].name;

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
});
