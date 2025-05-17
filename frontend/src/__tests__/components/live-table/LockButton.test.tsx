import React from "react";

import { describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen } from "@testing-library/react";

import LockButton from "@/components/live-table/LockButton";

describe("LockButton", () => {
  it("should render the lock button", () => {
    render(<LockButton />);
    const button = screen.getByRole("button", { name: /table lock options/i });
    expect(button).toBeInTheDocument();
  });

  it("should call console.log when clicked (placeholder for modal)", () => {
    const consoleSpy = vi.spyOn(console, "log");
    render(<LockButton />);
    const button = screen.getByRole("button", { name: /table lock options/i });
    fireEvent.click(button);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Lock button clicked, modal should open."
    );
    consoleSpy.mockRestore();
  });
});
