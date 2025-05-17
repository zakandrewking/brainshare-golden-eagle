/** Full header for the home page */

"use client";

import React from "react";

import DarkModeToggle from "@/components/DarkModeToggle";
// import { usePathname } from "next/navigation";
// import { toast } from "sonner";
// import { logOut } from "@/actions/log-out";
// import { useUser } from "@/utils/supabase/client";
import { cn } from "@/utils/tailwind";

import { fontTitle } from "../fonts";
import { NavigationButtonWithDrawer } from "./navigation-drawer";
import { FillSpace, Stack } from "./stack";

export default function NavigationHeaderTitle() {
  // const pathname = usePathname();

  // const [stateLogOut, formActionLogOut, isPending] = React.useActionState(
  //   logOut,
  //   { error: null }
  // );
  // const user = useUser();

  // React.useEffect(() => {
  //   if (stateLogOut?.error) {
  //     toast.error("Error logging out. Try again.");
  //   }
  // }, [stateLogOut]);

  return (
    <div className="h-16">
      <Stack
        direction="row"
        gap={2}
        component="header"
        className="sticky p-3 top-0 z-50 w-full h-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      >
        <NavigationButtonWithDrawer />
        <FillSpace />
        <h1
          className={cn(
            "text-3xl	mt-1 flex-shrink overflow-hidden",
            fontTitle.className
          )}
        >
          Brainshare
        </h1>
        <FillSpace />
        <div className="w-[80px] flex justify-end flex-shrink-100">
          <DarkModeToggle />
        </div>
        {/* {user ? (
          <form action={formActionLogOut}>
            <input type="hidden" name="redirect" value={pathname} />
            <Button variant="outline" disabled={isPending}>
              Log Out
            </Button>
          </form>
        ) : (
          <Button variant="outline" asChild>
            <Link href={logInRedirect(pathname)}>Log In</Link>
          </Button>
        )} */}
      </Stack>
    </div>
  );
}
