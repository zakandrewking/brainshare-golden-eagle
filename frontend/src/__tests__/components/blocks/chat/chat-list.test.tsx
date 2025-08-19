import {
  afterEach,
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
  waitFor,
} from "@testing-library/react";

import ChatList from "@/blocks/chat/chat-list";
import createChat from "@/blocks/chat/logic/create-chat";
import useChats from "@/blocks/chat/logic/use-chats";
import { useUser } from "@/utils/supabase/client";

vi.mock("@/blocks/chat/logic/create-chat", () => ({
  default: vi.fn(),
}));
vi.mock("@/blocks/chat/logic/use-chats", () => ({
  default: vi.fn(),
}));
vi.mock("@/utils/supabase/client");
vi.mock("@/hooks/use-is-ssr", () => ({
  default: () => false,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const mockUseChats = vi.mocked(useChats);
const mockCreateChat = vi.mocked(createChat);
const mockUseUser = vi.mocked(useUser);

describe("ChatList", () => {
  const mockMutate = vi.fn();

  beforeEach(() => {
    mockUseUser.mockReturnValue({ id: "user-123" } as ReturnType<
      typeof useUser
    >);
    mockCreateChat.mockResolvedValue({
      id: "chat-123",
      title: "New Chat",
      created_at: "2024-01-01T00:00:00Z",
      user_id: "user-123",
    });
    mockUseChats.mockReturnValue({
      data: [],
      error: null,
      isLoading: false,
      mutate: mockMutate,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should render new chat button", () => {
    render(<ChatList />);

    expect(screen.getByText("New Chat")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should call createChat when new chat button is clicked", async () => {
    mockCreateChat.mockResolvedValue({
      id: "chat-123",
      title: "New Chat",
      created_at: "2024-01-01T00:00:00Z",
      user_id: "user-123",
    });

    render(<ChatList />);

    const newChatButton = screen.getByText("New Chat");
    fireEvent.click(newChatButton);

    await waitFor(() => {
      expect(mockCreateChat).toHaveBeenCalledWith("New Chat", "user-123");
    });
  });

  it("should show empty state when no chats exist", () => {
    render(<ChatList />);

    expect(
      screen.getByText("No chats yet. Start a conversation to get started!")
    ).toBeInTheDocument();
  });

  it("should show chat list when chats exist", () => {
    const mockChats = [
      {
        id: "chat-1",
        title: "Test Chat 1",
        created_at: "2024-01-01T00:00:00Z",
        user_id: "user-123",
      },
      {
        id: "chat-2",
        title: "Test Chat 2",
        created_at: "2024-01-02T00:00:00Z",
        user_id: "user-123",
      },
    ];

    mockUseChats.mockReturnValue({
      data: mockChats,
      error: null,
      isLoading: false,
      mutate: mockMutate,
    });

    render(<ChatList />);

    expect(screen.getByText("Test Chat 1")).toBeInTheDocument();
    expect(screen.getByText("Test Chat 2")).toBeInTheDocument();
    expect(screen.getByText("Recent Chats")).toBeInTheDocument();
  });

  it("should have clickable chat items", () => {
    const mockChats = [
      {
        id: "chat-1",
        title: "Test Chat 1",
        created_at: "2024-01-01T00:00:00Z",
        user_id: "user-123",
      },
    ];

    mockUseChats.mockReturnValue({
      data: mockChats,
      error: null,
      isLoading: false,
      mutate: mockMutate,
    });

    render(<ChatList />);

    screen.getByText("Test Chat 1").closest("div");
  });
});
