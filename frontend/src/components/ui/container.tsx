import { ReactNode } from "react";

import { cn } from "@/utils/tailwind";

import { Stack } from "./stack";

/**
 * The container for any app content on the main page.
 */
export default function Container({
  gap = 0,
  className,
  children,
}: {
  gap?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Stack
      direction="col"
      alignItems="start"
      className={cn("p-4 w-full", className)}
      gap={gap}
    >
      {children}
    </Stack>
  );
}
