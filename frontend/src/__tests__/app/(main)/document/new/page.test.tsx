import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { render, screen } from "@testing-library/react";

import CreateDocument from "@/app/(main)/document/new/page";

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

vi.mock("@/app/(main)/document/new/actions", () => ({
  handleCreateRoomForm: vi.fn(),
}));

describe("CreateDocument", () => {
  it("should render the create document form with all fields", () => {
    render(<CreateDocument />);

    expect(screen.getByText("Create a document")).toBeInTheDocument();
    expect(screen.getByLabelText("Document Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Description (Optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Document Type")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Document" })
    ).toBeInTheDocument();
  });

  it("should show Create Document button text when not submitting", () => {
    render(<CreateDocument />);

    const button = screen.getByRole("button", { name: "Create Document" });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });
});
