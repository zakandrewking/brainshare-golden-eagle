"use client";

import React, { ReactNode } from "react";

import { VariantProps } from "class-variance-authority";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import { DelayedLoadingSpinner } from "@/components/ui/loading";
import { useDocuments } from "@/hooks/use-documents";
import { cn } from "@/utils/tailwind";

export function NavButton({
  href,
  match,
  setOpen,
  children,
  variant,
  className,
  title,
}: {
  href: string;
  match?: RegExp;
  setOpen: (open: boolean) => void;
  children: ReactNode;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  className?: string;
  title?: string;
}) {
  const pathname = usePathname();

  return (
    <Button
      variant={
        variant ||
        (match ? (pathname.match(match) ? "secondary" : "ghost") : "ghost")
      }
      className={cn("w-full justify-start text-left", className)}
      asChild
      onClick={() => setOpen(false)}
      title={title}
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}

export function DocumentNavList({
  setOpen,
}: {
  setOpen: (open: boolean) => void;
}) {
  const { documents, isLoading, error } = useDocuments();

  if (isLoading) {
    return (
      <div className="flex justify-center p-2">
        <DelayedLoadingSpinner />
      </div>
    );
  }

  if (error) {
    console.error("Error loading documents:", error);
    return (
      <div className="my-2 p-3 rounded-md border border-destructive bg-destructive/10 text-destructive">
        <h3 className="font-semibold">Error</h3>
        <p className="text-sm">Could not load documents. Please try again later.</p>
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <p className="p-2 text-sm text-muted-foreground">No documents yet.</p>
    );
  }

  return (
    <>
      {documents.map((doc) => (
        <NavButton
          key={doc.id}
          href={`/document/${doc.id}`}
          setOpen={setOpen}
          title={doc.title}
        >
          {doc.title}
        </NavButton>
      ))}
    </>
  );
}
