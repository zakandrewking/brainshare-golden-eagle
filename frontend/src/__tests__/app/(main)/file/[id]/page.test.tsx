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

import FilePage from "@/app/(main)/file/[id]/page";
import { getUser } from "@/utils/supabase/server";

vi.mock("@/utils/supabase/server");
vi.mock("@/blocks/files/file-preview", () => ({
  default: ({ id }: { id: string }) => (
    <div data-testid="file-preview-component">
      File Preview Component (id: {id})
    </div>
  ),
}));
vi.mock("@/components/ui/container", () => ({
  default: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="container" className={className}>
      {children}
    </div>
  ),
}));

const mockGetUser = vi.mocked(getUser);

describe("FilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show sign in message when user is not logged in", async () => {
    mockGetUser.mockResolvedValue({
      user: null,
      supabase: {} as SupabaseClient,
      session: null,
    });

    const page = await FilePage({
      params: Promise.resolve({ id: "file-123" }),
    });
    render(page);

    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(
      screen.getByText(
        "You need to log in to upload and manage files. Sign in to get started."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Log In")).toBeInTheDocument();
  });

  it("should render file preview component when user is logged in", async () => {
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

    const page = await FilePage({
      params: Promise.resolve({ id: "file-456" }),
    });
    render(page);

    expect(screen.getByTestId("container")).toBeInTheDocument();
    expect(screen.getByTestId("file-preview-component")).toBeInTheDocument();
    expect(
      screen.getByText("File Preview Component (id: file-456)")
    ).toBeInTheDocument();
    expect(screen.queryByText("You need to log in")).not.toBeInTheDocument();
  });
});
