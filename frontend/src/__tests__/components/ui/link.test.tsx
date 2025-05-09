import { expect, test } from "vitest";

import { render, screen } from "@testing-library/react";

import { InternalLink } from "@/components/ui/link";

test("InternalLink", () => {
  render(
    <InternalLink href="/" variant="default">
      Home
    </InternalLink>
  );
  expect(screen.getByRole("link", { name: "Home" })).toBeDefined();
});
