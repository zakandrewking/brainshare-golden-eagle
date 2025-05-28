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

describe("DocumentPage", () => {
  it("should render FlexTitle and LiveTable with correct props", async () => {
    const mockDocId = "test-doc-123";
    render(await DocumentPage({params: Promise.resolve({ docId: mockDocId })}));

    // Check if FlexTitle is rendered with correct title and description
    expect(await screen.findByTestId("flex-title")).toBeInTheDocument();
    expect(screen.getByText(`Document: ${mockDocId}`)).toBeInTheDocument();
    expect(
      screen.getByText(`Live collaborative table for document ${mockDocId}.`)
    ).toBeInTheDocument();

    // Check if LiveTable is rendered with the correct tableId
    const liveTableComponent = screen.getByTestId("live-table");
    expect(liveTableComponent).toBeInTheDocument();
    expect(liveTableComponent).toHaveTextContent(mockDocId);

    // Check if the LiveTable mock was called with the correct tableId prop
    const LiveTableMock = vi.mocked(LiveTable);
    expect(LiveTableMock).toHaveBeenCalledWith(
      expect.objectContaining({ tableId: mockDocId }),
      undefined
    );
  });
});
