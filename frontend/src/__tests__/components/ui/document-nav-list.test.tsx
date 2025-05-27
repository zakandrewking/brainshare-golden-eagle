import React from "react";

import { usePathname } from "next/navigation";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  act,
  render,
  screen,
} from "@testing-library/react";

import { DocumentNavList, NavButton } from "@/components/ui/document-nav-list";
import * as useDocumentsHook from "@/hooks/use-documents";

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    usePathname: vi.fn(() => "/"),
  };
});

const mockMutateDocuments = vi.fn();
const mockUseDocuments = vi.spyOn(useDocumentsHook, "useDocuments");

describe("DocumentNavList", () => {
  const mockSetOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDocuments.mockReturnValue({
      documents: [],
      isLoading: false,
      error: null,
      mutateDocuments: mockMutateDocuments,
    });
  });

  it("should render loading spinner when isLoading is true", () => {
    mockUseDocuments.mockReturnValue({
      documents: [],
      isLoading: true,
      error: null,
      mutateDocuments: mockMutateDocuments,
    });
    render(<DocumentNavList setOpen={mockSetOpen} />);
    // Assuming DelayedLoadingSpinner renders something identifiable or we mock
    // it too. For now, let's assume it contains a specific role or class if not
    // a direct text. If DelayedLoadingSpinner just renders an SVG, role
    // 'graphics-document' or similar might be present. Or, we can look for the
    // container div. Check for the SVG element, potentially by a class it has.
    const spinnerContainer = screen.getByText(
      (content, element) =>
        element?.tagName.toLowerCase() === "div" &&
        element.children.length === 1 &&
        element.children[0].tagName.toLowerCase() === "svg"
    );
    expect(spinnerContainer.firstChild).toHaveClass("animate-spin");
  });

  it("should render error message when error is present", () => {
    const errorMessage = "Failed to fetch documents.";
    mockUseDocuments.mockReturnValue({
      documents: [],
      isLoading: false,
      error: errorMessage,
      mutateDocuments: mockMutateDocuments,
    });
    render(<DocumentNavList setOpen={mockSetOpen} />);
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it("should render 'No documents yet.' when no documents and not loading/error", () => {
    mockUseDocuments.mockReturnValue({
      documents: [],
      isLoading: false,
      error: null,
      mutateDocuments: mockMutateDocuments,
    });
    render(<DocumentNavList setOpen={mockSetOpen} />);
    expect(screen.getByText("No documents yet.")).toBeInTheDocument();
  });

  it("should render list of documents when documents are provided", () => {
    const mockDocs = [
      { id: "1", liveblocks_id: "lb1", title: "Doc 1", type: "text" },
      { id: "2", liveblocks_id: "lb2", title: "Doc 2", type: "table" },
    ];
    mockUseDocuments.mockReturnValue({
      documents: mockDocs,
      isLoading: false,
      error: null,
      mutateDocuments: mockMutateDocuments,
    });
    render(<DocumentNavList setOpen={mockSetOpen} />);
    expect(screen.getByText("Doc 1")).toBeInTheDocument();
    expect(screen.getByText("Doc 2")).toBeInTheDocument();

    const link1 = screen.getByRole("link", { name: /Doc 1/i });
    expect(link1).toHaveAttribute("href", "/document/1");

    const link2 = screen.getByRole("link", { name: /Doc 2/i });
    expect(link2).toHaveAttribute("href", "/document/2");
  });

  it("NavButton sets active class based on pathname match", () => {
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue("/test-path");
    render(
      <NavButton
        href="/test-path"
        match={new RegExp("^/test-path$")}
        setOpen={mockSetOpen}
      >
        Test Link
      </NavButton>
    );
    // Button -> Link -> a. The Button gets the variant.
    // We need to check the class of the button element.
    // The NavButton applies 'secondary' variant if matched.
    // The buttonVariants cva would then apply specific classes for 'secondary'.
    // This is a bit deep; ideally, we'd test the visual outcome or a data-attribute.
    // For now, let's check if the button has a class that indicates it's secondary.
    // This depends on the exact classes applied by `buttonVariants({ variant: 'secondary' })`.
    // A simpler check might be to see if it's NOT 'ghost' if it would be ghost otherwise.
    const linkElement = screen.getByRole("link", { name: "Test Link" });
    // This assertion is highly dependent on the CSS classes from shadcn/ui's button component
    // and might be brittle. A more robust test might involve visual regression or a data-active attribute.
    expect(linkElement).toHaveClass("bg-secondary");
  });

  // Test for revalidation behavior (more conceptual for DocumentNavList itself)
  // This test demonstrates that if the hook's data changes, the component re-renders.
  // The actual triggering of 'mutate' is external to this component.
  it("should re-render when documents data changes via mutate", async () => {
    const initialDocs = [
      { id: "1", liveblocks_id: "lb1", title: "Initial Doc", type: "text" },
    ];
    let currentDocs = [...initialDocs];

    mockUseDocuments.mockImplementation(() => ({
      documents: currentDocs,
      isLoading: false,
      error: null,
      mutateDocuments: async () => {
        // Simulate data change that mutate would trigger
        currentDocs = [
          ...initialDocs,
          {
            id: "2",
            liveblocks_id: "lb2",
            title: "Newly Added Doc",
            type: "table",
          },
        ];
        // SWR's mutate would internally cause a re-render of consumers.
        // Here, we'll re-render with the new data to simulate SWR's effect.
        // This is a simplification. In a real scenario with SWR,
        // calling the original mutate would trigger the re-render.
        return undefined; // mutate returns Promise<Data | undefined>
      },
    }));

    const { rerender } = render(<DocumentNavList setOpen={mockSetOpen} />);
    expect(screen.getByText("Initial Doc")).toBeInTheDocument();
    expect(screen.queryByText("Newly Added Doc")).not.toBeInTheDocument();

    // Simulate external action causing data to change and SWR to update
    // In a real app, this `act` block would wrap the action that calls `mutateDocuments`
    await act(async () => {
      // This simulates the effect of `mutateDocuments` being called and SWR fetching new data
      currentDocs = [
        ...initialDocs,
        {
          id: "2",
          liveblocks_id: "lb2",
          title: "Newly Added Doc",
          type: "table",
        },
      ];
      // We need to trigger a re-render as if SWR updated the hook's state
      rerender(<DocumentNavList setOpen={mockSetOpen} />);
    });

    expect(screen.getByText("Initial Doc")).toBeInTheDocument();
    expect(screen.getByText("Newly Added Doc")).toBeInTheDocument();
  });
});
