"use client";

import { ReactNode } from "react";

import { YDocProvider } from "@y-sweet/react";

interface YSweetDocProviderProps {
  children: ReactNode;
  docId: string;
}

export default function YSweetDocProvider({ children, docId }: YSweetDocProviderProps) {
  return (
    <YDocProvider docId={docId} authEndpoint={async () => {
      return {
        baseUrl: "ws://localhost:8080",
        docId,
        url: "ws://localhost:8080",
        token: "TOKEN"
      };
    }}>
      {children}
    </YDocProvider>
  );
}
