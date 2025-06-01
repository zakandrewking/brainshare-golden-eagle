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

import { SearchCommand } from "@/components/ui/search-command";
import * as useDocumentsHook from "@/hooks/use-documents";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockMutateDocuments = vi.fn();
const mockUseDocuments = vi.spyOn(useDocumentsHook, "useDocuments");

describe("SearchCommand", () => {
  const mockOnOpenChange = vi.fn();
  const defaultProps = {
    open: true,
    onOpenChange: mockOnOpenChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDocuments.mockReturnValue({
      documents: [
        {
          id: "1",
          liveblocks_id: "lb1",
          title: "Test Document 1",
          type: "text",
        },
        {
          id: "2",
          liveblocks_id: "lb2",
          title: "Test Document 2",
          type: "table",
        },
      ],
      isLoading: false,
      error: null,
      mutateDocuments: mockMutateDocuments,
    });
  });

  it("should render search input and groups", () => {
    render(<SearchCommand {...defaultProps} />);

    expect(
      screen.getByPlaceholderText("Search pages and documents...")
    ).toBeInTheDocument();
    expect(screen.getByText("Pages")).toBeInTheDocument();
    expect(screen.getByText("Documents")).toBeInTheDocument();
  });

  it("should display hardcoded pages", () => {
    render(<SearchCommand {...defaultProps} />);

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Create a doc")).toBeInTheDocument();
    expect(screen.getByText("Planets")).toBeInTheDocument();
    expect(screen.getByText("Moons")).toBeInTheDocument();
  });

  it("should display documents from the database", () => {
    render(<SearchCommand {...defaultProps} />);

    expect(screen.getByText("Test Document 1")).toBeInTheDocument();
    expect(screen.getByText("Test Document 2")).toBeInTheDocument();
  });

  it("should navigate to selected page and close dialog", async () => {
    const user = userEvent.setup();
    render(<SearchCommand {...defaultProps} />);

    const homeItem = screen.getByText("Home");
    await user.click(homeItem);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("should navigate to selected document and close dialog", async () => {
    const user = userEvent.setup();
    render(<SearchCommand {...defaultProps} />);

    const documentItem = screen.getByText("Test Document 1");
    await user.click(documentItem);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    expect(mockPush).toHaveBeenCalledWith("/document/1");
  });

  it("should show no results when no documents exist", () => {
    mockUseDocuments.mockReturnValue({
      documents: [],
      isLoading: false,
      error: null,
      mutateDocuments: mockMutateDocuments,
    });

    render(<SearchCommand {...defaultProps} />);

    expect(screen.getByText("Pages")).toBeInTheDocument();
    expect(screen.queryByText("Documents")).not.toBeInTheDocument();
  });

  it("should close dialog when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<SearchCommand {...defaultProps} />);

    const input = screen.getByPlaceholderText("Search pages and documents...");
    await user.click(input);
    await user.keyboard("{Escape}");

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("should filter results based on search input", async () => {
    const user = userEvent.setup();
    render(<SearchCommand {...defaultProps} />);

    const input = screen.getByPlaceholderText("Search pages and documents...");
    await user.type(input, "Test Document 1");

    await waitFor(() => {
      expect(screen.getByText("Test Document 1")).toBeInTheDocument();
      expect(screen.queryByText("Test Document 2")).not.toBeInTheDocument();
    });
  });
});
