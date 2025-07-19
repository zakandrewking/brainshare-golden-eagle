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

import ChatList from "@/components/blocks/chat/chat-list";
import { useChats, useCreateChat } from "@/components/blocks/chat/logic/chat";
import { useUser } from "@/utils/supabase/client";

vi.mock("@/components/blocks/chat/logic/chat");
vi.mock("@/utils/supabase/client");
vi.mock("@/hooks/use-is-ssr", () => ({
  default: () => false,
}));

const mockUseChats = vi.mocked(useChats);
const mockUseCreateChat = vi.mocked(useCreateChat);
const mockUseUser = vi.mocked(useUser);

describe("ChatList", () => {
  const mockCreateChat = vi.fn();
  const mockMutate = vi.fn();

  beforeEach(() => {
    mockUseUser.mockReturnValue({ id: "user-123" } as ReturnType<
      typeof useUser
    >);
    mockUseCreateChat.mockReturnValue({ createChat: mockCreateChat });
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
    mockCreateChat.mockResolvedValue({ id: "chat-123", title: "New Chat" });

    render(<ChatList />);

    const newChatButton = screen.getByText("New Chat");
    fireEvent.click(newChatButton);

    await waitFor(() => {
      expect(mockCreateChat).toHaveBeenCalledWith();
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
});
