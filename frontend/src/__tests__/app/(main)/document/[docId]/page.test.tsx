import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { render, screen } from "@testing-library/react";

import DocumentPage from "@/app/(main)/document/[docId]/page";
import LiveTable from "@/components/live-table/LiveTable";

vi.mock("@/components/live-table/LiveTable", () => ({
  default: vi.fn(({ tableId }) => <div data-testid="live-table">{tableId}</div>),
}));

vi.mock("@/components/flex-title", () => ({
  default: vi.fn(({ title, description }) => (
    <div data-testid="flex-title">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )),
}));

vi.mock("@/app/(main)/document/[docId]/actions", () => ({
  getDocumentById: vi.fn().mockResolvedValue({
    id: "test-doc-123",
    title: "Test Document",
    description: "Test document description"
  }),
}));

describe("DocumentPage", () => {
  it("should render FlexTitle and LiveTable with correct props", async () => {
    const mockDocId = "test-doc-123";
    render(await DocumentPage({params: Promise.resolve({ docId: mockDocId })}));

    // Check if FlexTitle is rendered with correct title and description
    expect(await screen.findByTestId("flex-title")).toBeInTheDocument();
    expect(screen.getByText("Document: Test Document")).toBeInTheDocument();
    expect(
      screen.getByText("Live collaborative table for document Test Document.")
    ).toBeInTheDocument();

    // Check if LiveTable is rendered with the correct tableId
    const liveTableComponent = screen.getByTestId("live-table");
    expect(liveTableComponent).toBeInTheDocument();
    expect(liveTableComponent).toHaveTextContent(mockDocId);

    // Check if the LiveTable mock was called with the correct props
    const LiveTableMock = vi.mocked(LiveTable);
    expect(LiveTableMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: mockDocId,
        documentTitle: "Test Document",
        documentDescription: "Live collaborative table for document Test Document."
      }),
      undefined
    );
  });
});
