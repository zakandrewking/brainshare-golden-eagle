"use client";

import React from "react";

import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { logOut } from "@/components/auth/actions/log-out";
import { Button } from "@/components/ui/button";
import { useUser } from "@/utils/supabase/client";
import { logInRedirect } from "@/utils/url";

import { NavButton } from "../ui/document-nav-list";

export default function AccountButton({
  closeDrawer,
}: {
  closeDrawer: () => void;
}) {
  const pathname = usePathname();
  const [stateLogOut, formActionLogOut, isPending] = React.useActionState(
    logOut,
    { error: null }
  );
  const user = useUser();

  React.useEffect(() => {
    if (stateLogOut?.error) {
      toast.error("Error logging out. Try again.");
    }
  }, [stateLogOut]);

  if (user) {
    return (
      <form action={formActionLogOut}>
        <input type="hidden" name="redirect" value={pathname} />
        <Button variant="outline" disabled={isPending}>
          Log Out
        </Button>
      </form>
    );
  }
  return (
    <NavButton
      href={logInRedirect(pathname)}
      variant="outline"
      className="justify-center mb-2 mt-3"
      setOpen={closeDrawer}
    >
      Log In
    </NavButton>
  );
}
