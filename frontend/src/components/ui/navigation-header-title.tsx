"use client";

import React from "react";

import { useTheme } from "next-themes";

import DarkModeToggle from "@/components/dark-mode-toggle";
import useIsSSR from "@/hooks/use-is-ssr";
import { cn } from "@/utils/tailwind";

import { fontTitle } from "../fonts";
import { NavigationButtonWithDrawer } from "./navigation-drawer";
import { FillSpace, Stack } from "./stack";

export default function NavigationHeaderTitle() {
  const { resolvedTheme } = useTheme();
  const isSSR = useIsSSR();
  return (
    <div className="h-16">
      <Stack
        direction="row"
        gap={2}
        component="header"
        className="sticky p-3 top-0 z-50 w-full h-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      >
        <NavigationButtonWithDrawer />
        <FillSpace />
        {(resolvedTheme === "light" || isSSR) && (
        <h1
          className={cn(
            "text-3xl	mt-1 flex-shrink overflow-hidden",
            fontTitle.className
          )}
        >
          Brainshare
        </h1>)}
        <FillSpace />
        <div className="w-[80px] flex justify-end flex-shrink-100">
          <DarkModeToggle />
        </div>
      </Stack>
    </div>
  );
}
