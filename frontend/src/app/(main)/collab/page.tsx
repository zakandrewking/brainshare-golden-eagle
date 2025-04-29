"use client";

import React, { useState } from "react";

import { Database } from "@/database.types";

import Editor from "./Editor";
import Room from "./Room";
import Rooms from "./Rooms";
import Table from "./Table";

type Document = Database["public"]["Tables"]["document"]["Row"];

export default function CollabPage() {
  const [document, setDocument] = useState<Document | null>(null);

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="overflow-y-auto rounded border p-4 flex-shrink-0">
        <Rooms
          onSelectRoom={setDocument}
          selectedRoomId={document?.liveblocks_id ?? null}
        />
      </div>
      <div className="rounded border p-4 flex-grow overflow-hidden">
        {document ? (
          <Room key={document.id} roomId={document.liveblocks_id}>
            {document && (document.type === "table" ? <Table /> : <Editor />)}
          </Room>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">
              Select a room to start collaborating.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
