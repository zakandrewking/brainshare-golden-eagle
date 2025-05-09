"use client";

import { ReactNode } from "react";

import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
} from "@liveblocks/react/suspense";

import { LoadingSpinner } from "@/components/ui/loading";

interface RoomProps {
  children: ReactNode;
  roomId: string;
}

const publicApiKey = process.env.NEXT_PUBLIC_LIVEBLOCKS_API_KEY!;

export default function Room({ children, roomId }: RoomProps) {
  return (
    <LiveblocksProvider publicApiKey={publicApiKey}>
      <RoomProvider id={roomId} initialPresence={{ cursor: null }}>
        <ClientSideSuspense fallback={<LoadingSpinner />}>
          {() => children}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}
