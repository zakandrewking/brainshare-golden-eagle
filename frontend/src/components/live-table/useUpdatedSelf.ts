import { useEffect } from "react";

import { useSelf } from "@liveblocks/react";
import { LiveblocksYjsProvider } from "@liveblocks/yjs";

export const useUpdatedSelf = (yProvider: LiveblocksYjsProvider) => {
  const self = useSelf();

  useEffect(() => {
    yProvider.awareness.setLocalStateField("user", {
      name: self?.info?.name ?? "Anonymous",
      color: self?.info?.color ?? "#000000",
    });
  }, [self?.info?.name, self?.info?.color, yProvider.awareness]);
};
