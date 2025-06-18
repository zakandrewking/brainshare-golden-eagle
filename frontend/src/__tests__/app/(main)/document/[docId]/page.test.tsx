import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { render, screen } from "@testing-library/react";

import DocumentPage from "@/app/(main)/document/[docId]/page";

vi.mock("@/app/(main)/document/[docId]/document-page-client", () => ({
  default: vi.fn(({ docId, initialDocument }) => (
    <div data-testid="document-page-client">
      <span>DocId: {docId}</span>
      {initialDocument ? (
        <div>
          <span>Title: {initialDocument.title}</span>
          <span>Description: {initialDocument.description}</span>
          <span>LiveblocksId: {initialDocument.liveblocks_id}</span>
          <span>YsweetId: {initialDocument.ysweet_id}</span>
        </div>
      ) : (
        <span>No document</span>
      )}
    </div>
  )),
}));

vi.mock("@/app/(main)/document/[docId]/actions", () => ({
  getDocumentById: vi.fn().mockResolvedValue({
    id: "test-doc-123",
    title: "Test Document",
    liveblocks_id: "test-room-123",
    ysweet_id: "test-ysweet-123",
    description: "Test document description",
  }),
}));

describe("DocumentPage", () => {
  it("should render DocumentPageClient with correct props when document exists", async () => {
    const mockDocId = "test-doc-123";
    render(
      await DocumentPage({ params: Promise.resolve({ docId: mockDocId }) })
    );

    expect(screen.getByTestId("document-page-client")).toBeInTheDocument();
    expect(screen.getByText("DocId: test-doc-123")).toBeInTheDocument();
    expect(screen.getByText("Title: Test Document")).toBeInTheDocument();
    expect(
      screen.getByText("Description: Test document description")
    ).toBeInTheDocument();
    expect(screen.getByText("LiveblocksId: test-room-123")).toBeInTheDocument();
    expect(screen.getByText("YsweetId: test-ysweet-123")).toBeInTheDocument();
  });

  it("should render 'Document not found' when getDocumentById fails", async () => {
    const { getDocumentById } = await import(
      "@/app/(main)/document/[docId]/actions"
    );
    vi.mocked(getDocumentById).mockRejectedValueOnce(
      new Error("Document not found")
    );

    const mockDocId = "nonexistent-doc";
    render(
      await DocumentPage({ params: Promise.resolve({ docId: mockDocId }) })
    );

    expect(screen.getByText("Document not found")).toBeInTheDocument();
    expect(
      screen.queryByTestId("document-page-client")
    ).not.toBeInTheDocument();
  });

  it("should render 'Document not found' when document exists but has no ysweet_id", async () => {
    const { getDocumentById } = await import(
      "@/app/(main)/document/[docId]/actions"
    );
    vi.mocked(getDocumentById).mockResolvedValueOnce({
      id: "test-doc-123",
      title: "Test Document",
      liveblocks_id: "test-room-123",
      ysweet_id: null,
      description: "Test document description",
    });

    const mockDocId = "test-doc-123";
    render(
      await DocumentPage({ params: Promise.resolve({ docId: mockDocId }) })
    );

    expect(screen.getByText("Document not found")).toBeInTheDocument();
    expect(
      screen.queryByTestId("document-page-client")
    ).not.toBeInTheDocument();
  });
});
