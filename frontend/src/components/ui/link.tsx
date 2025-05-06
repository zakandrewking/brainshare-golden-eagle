import React from "react";

import { VariantProps } from "class-variance-authority";
import { ExternalLink as ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "./button";

export function ExternalLink({
  href,
  children,
  className,
  disabled,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <Button variant="link" className={className} disabled>
        {children}
        <ExternalLinkIcon size={"0.8em"} className="ml-1" />
      </Button>
    );
  }
  return (
    <Button variant="link" asChild className={className}>
      <Link href={href} target="_blank">
        {children}
        <ExternalLinkIcon size={"0.8em"} className="ml-1" />
      </Link>
    </Button>
  );
}

export function InternalLink({
  href,
  children,
  className,
  disabled,
  variant = "link",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  variant: VariantProps<typeof buttonVariants>["variant"];
}) {
  if (disabled) {
    return (
      <Button variant={variant} className={className} disabled>
        {children}
      </Button>
    );
  }
  return (
    <Button variant={variant} asChild className={className}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
