import "@xyflow/react/dist/style.css";

import React from "react";

import { ReactFlow } from "@xyflow/react";

const initialNodes = [
  { id: "1", position: { x: 0, y: 0 }, data: { label: "1" } },
  { id: "2", position: { x: 0, y: 100 }, data: { label: "2" } },
];
const initialEdges = [{ id: "e1-2", source: "1", target: "2" }];

export default function MindMap() {
  return (
    <div className="w-[1000px] h-[1000px]">
      <ReactFlow nodes={initialNodes} edges={initialEdges} />
    </div>
  );
}
