"use client";

import { useTheme } from "next-themes";
import Image from "next/image";

import useIsSSR from "@/hooks/use-is-ssr";
import { useHandleMenuButton } from "@/stores/navigationStore";

import { fontOrbitron } from "./fonts";
import robotCsv from "./robot-csv.png";
import { Button } from "./ui/button";
import { InternalLink } from "./ui/link";
import { Stack } from "./ui/stack";

export default function EmptyScreen() {
  const { resolvedTheme } = useTheme();
  const isSSR = useIsSSR();
  const handleMenuButton = useHandleMenuButton();

  return (
    <Stack direction="col" alignItems="center" className="w-full mb-16" gap={4}>
      {resolvedTheme === "dark" && !isSSR && (
        <div
          className={`text-5xl font-bold my-2 text-center ${fontOrbitron.className}`}
        >
          <span className="neon-text-magenta">WELCOME TO </span>
          <span className="ml-3 neon-text-cyan">BRAINSHARE.</span>
        </div>
      )}
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
      <p className="italic text-center">
        I&apos;m an AI, and I&apos;ll help you generate spreadsheets about any
        topic you like!
      </p>
      <div className="text-2xl font-bold text-center">
        Start by making a{" "}
        <InternalLink href="/document/new" className="text-2xl">
          New Sheet
        </InternalLink>
        , and then I&apos;ll fill in some data.
      </div>
      <p className="text-center">
        (Or check out the{" "}
        <Button
          variant="link"
          className="cursor-pointer"
          onClick={handleMenuButton}
        >
          Menu
        </Button>{" "}
        to see the sheets we already have.)
      </p>
    </Stack>
  );
}
