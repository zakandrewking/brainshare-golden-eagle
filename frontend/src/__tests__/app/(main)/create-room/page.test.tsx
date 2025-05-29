import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { render, screen } from "@testing-library/react";

import CreateRoom from "@/app/(main)/create-room/page";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}));

vi.mock("swr", () => ({
  useSWRConfig: vi.fn(() => ({
    mutate: vi.fn(),
  })),
}));

vi.mock("react-hook-form", () => ({
  useForm: vi.fn(() => ({
    register: vi.fn(() => ({})),
    formState: { errors: {} },
    setError: vi.fn(),
    reset: vi.fn(),
    setValue: vi.fn(),
  })),
}));

vi.mock("@/app/(main)/create-room/actions", () => ({
  handleCreateRoomForm: vi.fn(),
}));

describe("CreateRoom", () => {
  it("should render the create room form with all fields", () => {
    render(<CreateRoom />);

    expect(screen.getByText("Create a room")).toBeInTheDocument();
    expect(screen.getByLabelText("Room Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Description (Optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Document Type")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Room" })).toBeInTheDocument();
  });

  it("should show Create Room button text when not submitting", () => {
    render(<CreateRoom />);

    const button = screen.getByRole("button", { name: "Create Room" });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });
});
