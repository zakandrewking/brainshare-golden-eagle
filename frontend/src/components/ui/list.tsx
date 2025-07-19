import "./list.css";

import { ReactNode } from "react";

import Link from "next/link";

import { cn } from "@/utils/tailwind";

import { Button } from "./button";
import { Stack } from "./stack";

export function List({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Stack
      direction="col"
      gap={0}
      className={cn("w-full max-w-[700px]", className)}
    >
      {children}
    </Stack>
  );
}

export function ListItem({ children }: { children: ReactNode }) {
  return (
    <Stack
      direction="row"
      justifyContent="between"
      gap={0}
      className={"border-t-[1px] last:border-b-[1px] w-full list-item-hover"}
    >
      {children}
    </Stack>
  );
}

export function ListItemContent({
  href,
  children,
  className,
}: {
  href?: string;
  children: ReactNode;
  className?: string;
}) {
  const cl = cn(
    "py-1 pl-4 pr-1 h-full rounded-none self-stretch flex-grow flex items-center justify-start",
    className
  );
  if (href) {
    return (
      <Button variant="ghost" className={cl} asChild>
        <Link href={href}>{children}</Link>
      </Button>
    );
  } else {
    return <div className={cl}>{children}</div>;
  }
}

export function ListItemActions({ children }: { children: ReactNode }) {
  return (
    <div className="p-1 border-l-[1px] border-dotted list-item-action">
      {children}
    </div>
  );
}
