import { ReactNode } from "react";

import { cn } from "@/utils/tailwind";

import { Stack } from "./stack";

/**
 * The container for any app content on the main page. Has top margin to avoid
 * content being hidden behind the Menu.
 *
 * When using with NavigationHeaderTitle, pass in mt=0.
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
      className={cn("p-4 mt-12 w-full", className)}
      gap={gap}
    >
      {children}
    </Stack>
  );
}
