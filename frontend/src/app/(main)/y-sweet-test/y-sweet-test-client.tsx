"use client";

import { useCallback, useEffect } from "react";

import * as Y from "yjs";

import { useArray, useYjsProvider, YDocProvider } from "@y-sweet/react";

export function YSweetTestTasks() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = useArray<Y.Map<any>>("todolist");
  const yjsProvider = useYjsProvider();

  useEffect(() => {
    console.log("yjsProvider.status", yjsProvider.status);
  }, [yjsProvider.status]);

  const pushItem = useCallback(
    (text: string) => {
      const item = new Y.Map([
        ["text", text],
        ["done", false],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as [string, any][]);

      items?.push([item]);
    },
    [items]
  );

  return (
    <div className="m-16 flex flex-col gap-4">
      <button
        onClick={() => {
          pushItem("test" + Math.random());
        }}
      >
        Add
      </button>
      {items.map((item) => item?.get("text") ?? "").join(", ")}
    </div>
  );
}

export default function YSweetTestClient() {
  const docId = "fake-test-doc";
  return (
    <YDocProvider docId={docId} authEndpoint="/api/my-auth-endpoint">
      <YSweetTestTasks />
    </YDocProvider>
  );
}
