"use client";

import { memo } from "react";

import { useTheme } from "next-themes";
import Image from "next/image";

import useIsSSR from "@/hooks/use-is-ssr";

import { fontOrbitron } from "./fonts";
import robotCsv from "./robot-csv.png";
import { InternalLink } from "./ui/link";
import { Stack } from "./ui/stack";

export const EmptyScreen = memo(function EmptyScreen() {
  const { resolvedTheme } = useTheme();
  const isSSR = useIsSSR();
  return (
    <Stack direction="col" alignItems="center" className="w-full" gap={4}>
      {resolvedTheme === "dark" && !isSSR &&
      (<div className={`text-5xl font-bold my-2 text-center ${fontOrbitron.className}`}>
        <span className="neon-text-magenta">
          WELCOME TO{' '}
        </span>
        <span className="ml-3 neon-text-cyan">
          BRAINSHARE.
        </span>
      </div>)}
      <Image src={robotCsv} alt="robot-csv" className="w-56 mt-8" priority />
      <div className="text-2xl font-bold mt-4 flex flex-row items-center gap-4">
        <pre className="text-sm">
          {`
 ____     ____
|  0 |   | 0  |
'___/     \\___'
  `}
        </pre>
        <div>Hello, human.</div>
      </div>
      <div className="text-2xl font-bold">
        Let&apos;s start with:{" "}
        <InternalLink href="/planets" className="text-2xl">
          a list of some planets
        </InternalLink>
        .
      </div>
    </Stack>
  );
});
