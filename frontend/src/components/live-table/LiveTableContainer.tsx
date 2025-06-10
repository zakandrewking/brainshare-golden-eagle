import React from "react";

import { DebugNotice } from "./DebugNotice";

interface LiveTableContainerProps {
  children: React.ReactNode;
}

const LiveTableContainer: React.FC<LiveTableContainerProps> = ({
  children,
}) => {
  return (
    <div className="fixed flex flex-col bottom-0 left-0 right-0 h-[calc(100dvh-110px-env(safe-area-inset-top,0px))] p-1 z-10 bg-background">
      <DebugNotice />
      {children}
    </div>
  );
};

export default LiveTableContainer;
