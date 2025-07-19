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

import ChatPage from "@/app/(main)/chat/page";
import { getUser } from "@/utils/supabase/server";

vi.mock("@/utils/supabase/server");
vi.mock("@/components/blocks/chat/chat", () => ({
  default: () => <div data-testid="chat-component">Chat Component</div>,
}));
vi.mock("@/components/blocks/chat/chat-list", () => ({
  default: () => (
    <div data-testid="chat-list-component">Chat List Component</div>
  ),
}));
vi.mock("@/components/ui/container", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="container">{children}</div>
  ),
}));

const mockGetUser = vi.mocked(getUser);

describe("ChatPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show sign in message when user is not logged in", async () => {
    mockGetUser.mockResolvedValue({
      user: null,
      supabase: {} as SupabaseClient,
      session: null,
    });

    const page = await ChatPage();
    render(page);

    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(
      screen.getByText(
        "You need to log in to view and manage chats. Sign in to get started."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Log In")).toBeInTheDocument();
  });

  it("should render chat components when user is logged in", async () => {
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

    const page = await ChatPage();
    render(page);

    expect(screen.getByTestId("container")).toBeInTheDocument();
    expect(screen.getByTestId("chat-list-component")).toBeInTheDocument();
    expect(screen.getByTestId("chat-component")).toBeInTheDocument();
    expect(screen.queryByText("You need to log in")).not.toBeInTheDocument();
  });
});
