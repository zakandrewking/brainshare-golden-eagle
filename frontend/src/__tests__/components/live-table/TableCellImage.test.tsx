import React from "react";

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import TableCell from "@/components/live-table/TableCell";

vi.mock("@/stores/awareness-store", () => ({
  useFirstUserColorForCell: vi.fn(() => null),
  useHasOtherUserCursors: vi.fn(() => false),
}));

vi.mock("@/stores/dataStore", () => ({
  useEditingCell: vi.fn(() => null),
  useHandleCellChange: vi.fn(() => vi.fn()),
  useIsCellLocked: vi.fn(() => false),
  useLockNoteForCell: vi.fn(() => undefined),
  useSetEditingCell: vi.fn(() => vi.fn()),
}));

vi.mock("@/stores/selectionStore", () => ({
  useSelectionStartOrMove: vi.fn(() => vi.fn()),
  useSelectIsCellInSelection: vi.fn(() => false),
  useSelectIsCellSelected: vi.fn(() => false),
}));

describe("TableCell Image Rendering", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders an image when cell contains image URL", () => {
    const imageUrl = "https://example.com/image.jpg";

    render(
      <TableCell rowIndex={0} colIndex={0} header="image" value={imageUrl} />
    );

    const image = screen.getByRole("img");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("src", imageUrl);
    expect(image).toHaveAttribute("alt", "Cell content");
  });

  it("renders an input when cell contains non-image text", () => {
    const textValue = "Regular text value";

    render(
      <TableCell rowIndex={0} colIndex={0} header="text" value={textValue} />
    );

    const input = screen.getByDisplayValue(textValue);
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  it("renders an input when editing even if cell contains image URL", async () => {
    const imageUrl = "https://example.com/image.jpg";

    // Mock editing state for this specific test
    const dataStore = await import("@/stores/dataStore");
    vi.mocked(dataStore.useEditingCell).mockReturnValue({
      rowIndex: 0,
      colIndex: 0,
    });

    render(
      <TableCell rowIndex={0} colIndex={0} header="image" value={imageUrl} />
    );

    const input = screen.getByDisplayValue(imageUrl);
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");

    // Should not render an image when editing
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("switches to input mode when double-clicking an image", async () => {
    const user = userEvent.setup();
    const imageUrl = "https://example.com/image.png";
    const mockSetEditingCell = vi.fn();

    const dataStore = await import("@/stores/dataStore");
    vi.mocked(dataStore.useSetEditingCell).mockReturnValue(mockSetEditingCell);

    render(
      <TableCell rowIndex={0} colIndex={0} header="image" value={imageUrl} />
    );

    const image = screen.getByRole("img");
    await user.dblClick(image);

    expect(mockSetEditingCell).toHaveBeenCalledWith({
      rowIndex: 0,
      colIndex: 0,
    });
  });

  it("falls back to input when image fails to load", () => {
    const imageUrl = "https://example.com/broken-image.jpg";

    render(
      <TableCell rowIndex={0} colIndex={0} header="image" value={imageUrl} />
    );

    const image = screen.getByRole("img");

    // Simulate image load error
    fireEvent.error(image);

    // After error, it should show the input instead
    expect(screen.getByDisplayValue(imageUrl)).toBeInTheDocument();
  });

  it("recognizes various image file extensions", () => {
    const testCases = [
      "https://example.com/image.jpg",
      "https://example.com/image.jpeg",
      "https://example.com/image.png",
      "https://example.com/image.gif",
      "https://example.com/image.webp",
      "https://example.com/image.svg",
      "https://example.com/image.bmp",
      "https://example.com/image.ico",
      "https://example.com/image.tiff",
      "https://example.com/image.png?v=123", // with query params
      "https://example.com/image.jpg#section", // with fragment
      "https://en.wikipedia.org/wiki/Test#/media/File:Example.jpg", // Wikipedia media
    ];

    testCases.forEach((url, index) => {
      const { unmount } = render(
        <TableCell rowIndex={index} colIndex={0} header="image" value={url} />
      );

      expect(screen.getByRole("img")).toBeInTheDocument();
      unmount();
    });
  });

  it("does not render image for non-URL text", () => {
    const nonImageValues = [
      "just text",
      "not-a-url.jpg", // missing protocol
      "https://example.com/document.pdf", // wrong extension
      "ftp://example.com/image.jpg", // wrong protocol
      "",
      null,
      undefined,
    ];

    nonImageValues.forEach((value, index) => {
      const { unmount } = render(
        <TableCell rowIndex={index} colIndex={0} header="text" value={value} />
      );

      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
      unmount();
    });
  });

  it("applies minimum height style when rendering images", () => {
    const imageUrl = "https://example.com/image.jpg";

    render(
      <TableCell rowIndex={0} colIndex={0} header="image" value={imageUrl} />
    );

    const cell = screen.getByTestId("table-cell");
    expect(cell).toHaveStyle({ minHeight: "80px" });
  });

  it("does not apply minimum height when not rendering images", () => {
    const textValue = "Regular text";

    render(
      <TableCell rowIndex={0} colIndex={0} header="text" value={textValue} />
    );

    const cell = screen.getByTestId("table-cell");
    expect(cell).toHaveStyle({ minHeight: "auto" });
  });
});
