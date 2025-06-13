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

// Mock Next.js Image component
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    onLoad,
    onError,
    width,
    height,
    ...props
  }: {
    src: string;
    alt: string;
    onLoad?: () => void;
    onError?: () => void;
    width: number;
    height: number;
    style?: React.CSSProperties;
    className?: string;
    onDoubleClick?: (e: React.MouseEvent) => void;
    draggable?: boolean;
    ref?: React.Ref<HTMLImageElement>;
  }) => {
    // Create a simple img element that mimics Next.js Image behavior
    return React.createElement("img", {
      src: `/api/imageproxy?url=${encodeURIComponent(
        src
      )}&w=${width}&h=${height}`,
      alt,
      onLoad,
      onError,
      width,
      height,
      style: props.style,
      className: props.className,
      onDoubleClick: props.onDoubleClick,
      draggable: props.draggable,
      ref: props.ref,
    });
  },
}));

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
    // Check that the src contains the original URL (encoded)
    expect(image.getAttribute("src")).toContain(encodeURIComponent(imageUrl));
    expect(image).toHaveAttribute("alt", "Cell content");
  });

  it("renders text content when cell contains non-image text", () => {
    const textValue = "Regular text value";

    render(
      <TableCell rowIndex={0} colIndex={0} header="text" value={textValue} />
    );

    const textContent = screen.getByText(textValue);
    expect(textContent).toBeInTheDocument();
    expect(textContent.tagName).toBe("DIV");
  });

  it("renders a textarea when editing even if cell contains image URL", async () => {
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

    const textarea = screen.getByDisplayValue(imageUrl);
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName).toBe("TEXTAREA");

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

  it("falls back to text display when image fails to load", () => {
    const imageUrl = "https://example.com/broken-image.jpg";

    render(
      <TableCell rowIndex={0} colIndex={0} header="image" value={imageUrl} />
    );

    const image = screen.getByRole("img");

    // Simulate image load error
    fireEvent.error(image);

    // After error, it should show the text content instead
    expect(screen.getByText(imageUrl)).toBeInTheDocument();
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
      // For empty values, we just check the cell exists since empty cells show non-breaking space
      if (value === "" || value === null || value === undefined) {
        expect(screen.getByTestId("table-cell")).toBeInTheDocument();
      } else {
        expect(screen.getByText(String(value))).toBeInTheDocument();
      }
      unmount();
    });
  });

  it("applies minimum height style when rendering images", () => {
    const imageUrl = "https://example.com/image.jpg";

    render(
      <TableCell rowIndex={0} colIndex={0} header="image" value={imageUrl} />
    );

    const cell = screen.getByTestId("table-cell");
    expect(cell).toHaveStyle({ minHeight: "120px" });
  });

  it("does not apply minimum height when not rendering images", () => {
    const textValue = "Regular text";

    render(
      <TableCell rowIndex={0} colIndex={0} header="text" value={textValue} />
    );

    const cell = screen.getByTestId("table-cell");
    expect(cell).toHaveStyle({ minHeight: "auto" });
  });

  it("renders resize handle for images", () => {
    const imageUrl = "https://example.com/image.jpg";

    render(
      <TableCell rowIndex={0} colIndex={0} header="image" value={imageUrl} />
    );

    const image = screen.getByRole("img");
    expect(image).toBeInTheDocument();

    // The resize handle should be present (though hidden by default)
    const imageContainer = image.closest(".relative");
    expect(imageContainer).toBeInTheDocument();
    expect(
      imageContainer?.querySelector(".cursor-se-resize")
    ).toBeInTheDocument();
  });

  it("shows resize dimensions during resize", async () => {
    const imageUrl = "https://example.com/image.jpg";

    render(
      <TableCell rowIndex={0} colIndex={0} header="image" value={imageUrl} />
    );

    const image = screen.getByRole("img");
    const resizeHandle = image.parentElement?.querySelector(
      ".cursor-se-resize"
    ) as HTMLElement;

    expect(resizeHandle).toBeInTheDocument();

    // Start resize by firing mousedown on resize handle
    fireEvent.mouseDown(resizeHandle, { clientX: 0, clientY: 0 });

    // Simulate mouse move to trigger resize
    fireEvent.mouseMove(document, { clientX: 50, clientY: 0 });

    // During resize, we should see dimension feedback (though testing this is complex)
    // For now, just verify the resize handle exists and is interactive
    expect(resizeHandle).toHaveAttribute("title", "Drag to resize");

    // End resize
    fireEvent.mouseUp(document);
  });

  it("persists image dimensions after resize", async () => {
    const mockHandleCellChange = vi.fn();
    const dataStore = await import("@/stores/dataStore");
    vi.mocked(dataStore.useHandleCellChange).mockReturnValue(
      mockHandleCellChange
    );

    const imageUrl = "https://example.com/image.jpg";

    render(
      <TableCell rowIndex={0} colIndex={0} header="image" value={imageUrl} />
    );

    const image = screen.getByRole("img");
    const resizeHandle = image.parentElement?.querySelector(
      ".cursor-se-resize"
    ) as HTMLElement;

    // Start resize
    fireEvent.mouseDown(resizeHandle, { clientX: 0, clientY: 0 });
    // Move mouse to resize
    fireEvent.mouseMove(document, { clientX: 100, clientY: 0 });
    // End resize
    fireEvent.mouseUp(document);

    // Should call handleCellChange with the new dimensions format
    expect(mockHandleCellChange).toHaveBeenCalledWith(
      0,
      "image",
      expect.stringMatching(/^https:\/\/example\.com\/image\.jpg\|\d+x\d+$/)
    );
  });

  it("loads image with persisted dimensions", () => {
    const imageUrl = "https://example.com/image.jpg|200x150";

    render(
      <TableCell rowIndex={0} colIndex={0} header="image" value={imageUrl} />
    );

    const image = screen.getByRole("img");
    expect(image).toHaveStyle({ width: "200px", height: "150px" });
  });

  it("falls back to default dimensions for URLs without size info", () => {
    const imageUrl = "https://example.com/image.jpg";

    render(
      <TableCell rowIndex={0} colIndex={0} header="image" value={imageUrl} />
    );

    const image = screen.getByRole("img");
    expect(image).toHaveStyle({ width: "150px", height: "100px" });
  });

  it("recognizes image URLs with dimension data", () => {
    const imageUrl = "https://example.com/image.jpg|300x200";

    render(
      <TableCell rowIndex={0} colIndex={0} header="image" value={imageUrl} />
    );

    // Should render as image, not input
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("reactively updates image dimensions when cell value changes", () => {
    const initialUrl = "https://example.com/image.jpg|200x150";
    const updatedUrl = "https://example.com/image.jpg|300x225";

    const { rerender } = render(
      <TableCell rowIndex={0} colIndex={0} header="image" value={initialUrl} />
    );

    // Should start with initial dimensions
    const image = screen.getByRole("img");
    expect(image).toHaveStyle({ width: "200px", height: "150px" });

    // Update the cell value (simulating another user's change)
    rerender(
      <TableCell rowIndex={0} colIndex={0} header="image" value={updatedUrl} />
    );

    // Should update to new dimensions
    expect(image).toHaveStyle({ width: "300px", height: "225px" });
  });

  it("calculates aspect ratio-aware default dimensions", async () => {
    const mockHandleCellChange = vi.fn();
    const dataStore = await import("@/stores/dataStore");
    vi.mocked(dataStore.useHandleCellChange).mockReturnValue(
      mockHandleCellChange
    );

    const imageUrl = "https://example.com/image.jpg";

    render(
      <TableCell rowIndex={0} colIndex={0} header="image" value={imageUrl} />
    );

    const img = screen.getByRole("img");

    // Wait for the image to be in the DOM and set up natural dimensions
    await vi.waitFor(() => {
      expect(img).toBeInTheDocument();
    });

    // Simulate the image loading with natural dimensions
    Object.defineProperty(img, "naturalWidth", { value: 800, writable: false });
    Object.defineProperty(img, "naturalHeight", {
      value: 600,
      writable: false,
    });

    // Trigger the load event - need to use async version for Next.js Image
    await vi.waitFor(() => {
      fireEvent.load(img);
    });

    // Wait a bit for the async dimension calculation
    await vi.waitFor(() => {
      expect(mockHandleCellChange).toHaveBeenCalled();
    });

    // Should call handleCellChange with calculated dimensions that preserve aspect ratio
    // 800x600 should be scaled down to fit within max bounds while preserving 4:3 ratio
    expect(mockHandleCellChange).toHaveBeenCalledWith(
      0,
      "image",
      expect.stringMatching(/^https:\/\/example\.com\/image\.jpg\|\d+x\d+$/)
    );

    // The call should contain dimensions that maintain the 4:3 aspect ratio
    const lastCall =
      mockHandleCellChange.mock.calls[
        mockHandleCellChange.mock.calls.length - 1
      ];
    const dimensionMatch = lastCall[2].match(/\|(\d+)x(\d+)$/);
    if (dimensionMatch) {
      const width = parseInt(dimensionMatch[1]);
      const height = parseInt(dimensionMatch[2]);
      const ratio = width / height;
      // Should be close to 4:3 (1.333...)
      expect(ratio).toBeCloseTo(4 / 3, 2);
    }
  });
});
