"use client";

import React from "react";

import { LogIn, LogOut } from "lucide-react";
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
      <form action={formActionLogOut} className="w-full">
        <input type="hidden" name="redirect" value={pathname} />
        <Button
          variant="outline"
          className="justify-center w-full"
          disabled={isPending}
          onClick={() => closeDrawer()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log Out
        </Button>
      </form>
    );
  }
  return (
    <NavButton
      href={logInRedirect(pathname)}
      variant="outline"
      className="justify-center"
      setOpen={closeDrawer}
    >
      <LogIn className="mr-2 h-4 w-4" />
      Log In
    </NavButton>
  );
}
