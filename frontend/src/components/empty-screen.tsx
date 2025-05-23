import Image from "next/image";

import robotCsv from "./robot-csv.png";
import { InternalLink } from "./ui/link";
import { Stack } from "./ui/stack";

export function EmptyScreen() {
  return (
    <Stack direction="col" alignItems="center" className="w-full" gap={4}>
      <Image src={robotCsv} alt="robot-csv" className="w-56" priority />
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
      <div className="text-2xl font-bold my-2">Welcome to BRAINSHARE.</div>
      <div className="text-2xl font-bold">
        Let&apos;s start with:{" "}
        <InternalLink href="/planets" className="text-2xl">
          a list of some planets
        </InternalLink>
        .
      </div>
    </Stack>
  );
}
