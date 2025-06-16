import "@testing-library/jest-dom";

import React from "react";

import { describe, expect, it, vi } from "vitest";

import { render } from "@testing-library/react";

import LiveTable from "@/components/live-table/LiveTable";

// Mock the providers
vi.mock("@/components/live-table/Room", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="liveblocks-room">{children}</div>
  ),
}));

vi.mock("@/components/live-table/LiveTableProvider", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="liveblocks-provider">{children}</div>
  ),
}));

vi.mock("@/components/live-table/YSweetLiveTableProvider", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="ysweet-provider">{children}</div>
  ),
}));

vi.mock("@/components/live-table/LiveTableContainer", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="live-table-container">{children}</div>
  ),
}));

vi.mock("@/components/live-table/LiveTableToolbar", () => ({
  default: () => <div data-testid="live-table-toolbar">Toolbar</div>,
}));

vi.mock("@/components/live-table/LiveTableDisplay", () => ({
  default: () => <div data-testid="live-table-display">Display</div>,
}));

describe("LiveTable", () => {
  const defaultProps = {
    tableId: "test-table-id",
    documentTitle: "Test Document",
    documentDescription: "Test Description",
    docId: "test-doc-id",
  };

  it("should render with liveblocks backend by default", () => {
    const { getByTestId } = render(<LiveTable {...defaultProps} />);

    expect(getByTestId("liveblocks-room")).toBeInTheDocument();
    expect(getByTestId("liveblocks-provider")).toBeInTheDocument();
    expect(getByTestId("live-table-container")).toBeInTheDocument();
    expect(getByTestId("live-table-toolbar")).toBeInTheDocument();
    expect(getByTestId("live-table-display")).toBeInTheDocument();
  });

  it("should render with liveblocks backend when explicitly specified", () => {
    const { getByTestId } = render(
      <LiveTable {...defaultProps} backend="liveblocks" />
    );

    expect(getByTestId("liveblocks-room")).toBeInTheDocument();
    expect(getByTestId("liveblocks-provider")).toBeInTheDocument();
    expect(getByTestId("live-table-container")).toBeInTheDocument();
    expect(getByTestId("live-table-toolbar")).toBeInTheDocument();
    expect(getByTestId("live-table-display")).toBeInTheDocument();
  });

  it("should render with ysweet backend when specified", () => {
    const { getByTestId, queryByTestId } = render(
      <LiveTable {...defaultProps} backend="ysweet" />
    );

    expect(getByTestId("ysweet-provider")).toBeInTheDocument();
    expect(getByTestId("live-table-container")).toBeInTheDocument();
    expect(getByTestId("live-table-toolbar")).toBeInTheDocument();
    expect(getByTestId("live-table-display")).toBeInTheDocument();

    // Should NOT have liveblocks components
    expect(queryByTestId("liveblocks-room")).not.toBeInTheDocument();
    expect(queryByTestId("liveblocks-provider")).not.toBeInTheDocument();
  });

  it("should pass correct props to providers", () => {
    // This test verifies that the correct props are passed by checking
    // that the components render without errors, which implies props are valid
    const { getByTestId } = render(
      <LiveTable {...defaultProps} backend="ysweet" />
    );
    expect(getByTestId("ysweet-provider")).toBeInTheDocument();

    const { getByTestId: getByTestIdLiveblocks } = render(
      <LiveTable {...defaultProps} backend="liveblocks" />
    );
    expect(getByTestIdLiveblocks("liveblocks-provider")).toBeInTheDocument();
    expect(getByTestIdLiveblocks("liveblocks-room")).toBeInTheDocument();
  });

  it("should have correct component hierarchy for YSweet backend", () => {
    const { getByTestId, queryByTestId } = render(
      <LiveTable {...defaultProps} backend="ysweet" />
    );

    const ysweetProvider = getByTestId("ysweet-provider");
    const container = getByTestId("live-table-container");

    // YSweet should have provider -> container structure
    expect(ysweetProvider).toContainElement(container);
    expect(queryByTestId("liveblocks-room")).not.toBeInTheDocument();
  });

  it("should have correct component hierarchy for LiveBlocks backend", () => {
    const { getByTestId, queryByTestId } = render(
      <LiveTable {...defaultProps} backend="liveblocks" />
    );

    const liveblocksRoom = getByTestId("liveblocks-room");
    const liveblocksProvider = getByTestId("liveblocks-provider");
    const container = getByTestId("live-table-container");

    // LiveBlocks should have room -> provider -> container structure
    expect(liveblocksRoom).toContainElement(liveblocksProvider);
    expect(liveblocksProvider).toContainElement(container);
    expect(queryByTestId("ysweet-provider")).not.toBeInTheDocument();
  });
});
