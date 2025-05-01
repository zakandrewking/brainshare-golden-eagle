"use client";

import "@xyflow/react/dist/style.css";

import React, {
  useEffect,
  useState,
} from "react";

import { useTheme } from "next-themes";
import useSWR from "swr";

import { ColorMode, ReactFlow } from "@xyflow/react";

import { createClient } from "@/utils/supabase/client";

export default function MindMap() {
  const { theme } = useTheme();
  // use state for the colorMode to avoid hydration errors
  const [colorMode, setColorMode] = useState<ColorMode>("light");
  const supabase = createClient();

  const { data } = useSWR("/api/nodes", async () => {
    const { data, error } = await supabase.from("node").select("*");
    const nodes = data?.map((node) => ({
      id: node.id,
      position: { x: node.position_x, y: node.position_y },
      data: { label: node.title },
    }));
    if (error) throw error;
    const { data: edges, error: edgesError } = await supabase
      .from("edge")
      .select("*");
    if (edgesError) throw edgesError;
    return { nodes, edges };
  });
  const nodes = data?.nodes;
  const edges = data?.edges;

  useEffect(() => {
    setColorMode((theme || "light") as ColorMode);
  }, [theme]);

  if (!nodes) return <div>Loading...</div>;
  if (!edges) return <div>Loading...</div>;

  return (
    <div className="w-[1000px] h-[1000px]">
      <ReactFlow nodes={nodes} edges={edges} colorMode={colorMode} />
    </div>
  );
}
