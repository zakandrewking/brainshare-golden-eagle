import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  Session,
  SupabaseClient,
  User,
} from "@supabase/supabase-js";
import { render, screen } from "@testing-library/react";

import FilesPage from "@/app/(main)/files/page";
import { getUser } from "@/utils/supabase/server";

vi.mock("@/utils/supabase/server");
vi.mock("@/components/blocks/files/files-manager", () => ({
  default: ({ isOverLimit }: { isOverLimit: boolean }) => (
    <div data-testid="files-manager-component">
      Files Manager Component (isOverLimit: {isOverLimit.toString()})
    </div>
  ),
}));
vi.mock("@/components/ui/container", () => ({
  default: ({ children, gap }: { children: React.ReactNode; gap?: number }) => (
    <div data-testid="container" data-gap={gap}>
      {children}
    </div>
  ),
}));
vi.mock("@/components/ui/stack", () => ({
  Stack: ({
    children,
    direction,
    gap,
    alignItems,
    className,
  }: {
    children: React.ReactNode;
    direction?: string;
    gap?: number;
    alignItems?: string;
    className?: string;
  }) => (
    <div
      data-testid="stack"
      data-direction={direction}
      data-gap={gap}
      data-align-items={alignItems}
      className={className}
    >
      {children}
    </div>
  ),
}));
vi.mock("@/utils/file-types", () => ({
  getSupportedFileTypesDisplay: () => "PDF, DOC, TXT",
}));

const mockGetUser = vi.mocked(getUser);

describe("FilesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show sign in message when user is not logged in", async () => {
    mockGetUser.mockResolvedValue({
      user: null,
      supabase: {} as SupabaseClient,
      session: null,
    });

    const page = await FilesPage();
    render(page);

    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(
      screen.getByText(
        "You need to log in to upload and manage files. Sign in to get started."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Log In")).toBeInTheDocument();
  });

  it("should render files components when user is logged in", async () => {
    const mockUser: User = {
      id: "user-123",
      email: "test@example.com",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      aud: "authenticated",
      role: "authenticated",
      email_confirmed_at: "2024-01-01T00:00:00Z",
      phone: undefined,
      confirmed_at: "2024-01-01T00:00:00Z",
      last_sign_in_at: "2024-01-01T00:00:00Z",
      app_metadata: {},
      user_metadata: {},
      identities: [],
      factors: [],
    };

    mockGetUser.mockResolvedValue({
      user: mockUser,
      supabase: {} as SupabaseClient,
      session: {} as Session,
    });

    const page = await FilesPage();
    render(page);

    expect(screen.getByTestId("container")).toBeInTheDocument();
    expect(screen.getByTestId("stack")).toBeInTheDocument();
    expect(screen.getByText("File Upload")).toBeInTheDocument();
    expect(
      screen.getByText("Upload files. We currently support: PDF, DOC, TXT")
    ).toBeInTheDocument();
    expect(screen.getByTestId("files-manager-component")).toBeInTheDocument();
    expect(
      screen.getByText("Files Manager Component (isOverLimit: false)")
    ).toBeInTheDocument();
    expect(screen.queryByText("You need to log in")).not.toBeInTheDocument();
  });
});
