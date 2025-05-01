"use client";

import "@xyflow/react/dist/style.css";

import React, {
  useEffect,
  useState,
} from "react";

import { useTheme } from "next-themes";

import { ColorMode, ReactFlow } from "@xyflow/react";

const initialNodes = [
  { id: "1", position: { x: 0, y: 0 }, data: { label: "1" } },
  { id: "2", position: { x: 0, y: 100 }, data: { label: "2" } },
];
const initialEdges = [{ id: "e1-2", source: "1", target: "2" }];

export default function MindMap() {
  const { theme } = useTheme();
  // use state for the colorMode to avoid hydration errors
  const [colorMode, setColorMode] = useState<ColorMode>("light");
  useEffect(() => {
    setColorMode((theme || "light") as ColorMode);
  }, [theme]);
  return (
    <div className="w-[1000px] h-[1000px]">
      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        colorMode={colorMode}
      />
    </div>
  );
}
