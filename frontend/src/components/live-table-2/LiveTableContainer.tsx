import React from "react";

interface LiveTableContainerProps {
  children: React.ReactNode;
}

const LiveTableContainer: React.FC<LiveTableContainerProps> = ({
  children,
}) => {
  return (
    <div className="fixed flex flex-col bottom-0 left-0 right-0 h-[calc(100vh-200px)] p-1 z-10 bg-background">
      {children}
    </div>
  );
};

export default LiveTableContainer;
