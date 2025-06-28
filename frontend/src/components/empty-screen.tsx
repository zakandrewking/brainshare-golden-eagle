"use client";

import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";

import useIsSSR from "@/hooks/use-is-ssr";
import { useHandleMenuButton } from "@/stores/navigationStore";

import { fontOrbitron } from "./fonts";
import robotCsv from "./robot-csv.png";
import { Button } from "./ui/button";
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
      <Image src={robotCsv} alt="robot-csv" className="w-56 mt-4" priority />
      <div className="bg-black border border-gray-600 rounded-lg p-6 max-w-4xl font-mono text-sm">
        <div className="text-green-400 mb-4">
          <pre className="text-xs">
            {` ____     ____
|  0 |   | 0  |
'___/     \\___'
            `}
          </pre>
          <div className="text-lg font-bold">Hello, human.</div>
        </div>

        <div className="space-y-2">
          <div className="flex"></div>
          <div className="text-gray-300">
            <span className="text-green-400 mr-2">{">"}</span>
            We&apos;re on a mission to collect every true fact about the world.
          </div>
          <div className="text-gray-300">
            <span className="text-green-400 mr-2">{">"}</span>
            NBD.
          </div>
          <div className="text-gray-300">
            <span className="text-green-400 mr-2">{">"}</span>
            <span className="text-gray-300">
              You can help by making a{" "}
              <Button
                variant="link"
                className="text-blue-400 underline hover:text-blue-300 p-0 h-auto"
                asChild
              >
                <Link href="/document/new">New Data Sheet</Link>
              </Button>
              , and then I&apos;ll fill in some facts.
            </span>
          </div>

          <div className="flex">
            <span className="text-green-400 mr-2">{">"}</span>
            <span className="text-gray-300">
              Or check out the{" "}
              <Button
                variant="link"
                className="cursor-pointer text-blue-400 p-0 h-auto underline hover:text-blue-300 py-0"
                onClick={handleMenuButton}
              >
                Menu
              </Button>{" "}
              to see the sheets we already have.
            </span>
          </div>

          <div className="flex">
            <span className="text-green-400 mr-2">{">"}</span>
            <span className="text-gray-300">
              After that, we&apos;ll check my work & add citations. Let&apos;s
              get started!
            </span>
          </div>
        </div>
      </div>
    </Stack>
  );
}
