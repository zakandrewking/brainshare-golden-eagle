import { ReactNode } from "react";

import NavigationHeader from "@/components/ui/navigation-header";

export default async function Main({ children }: { children: ReactNode }) {
  return (
    <>
      <NavigationHeader />
      <main>{children}</main>
    </>
  );
}
