"use client";

import React from "react";

import { SiGithub } from "@icons-pack/react-simple-icons";

import { logInGithub } from "@/components/auth/actions/log-in-github";
import { Button } from "@/components/ui/button";

export function GitHubLoginButton({ redirectCode }: { redirectCode: string }) {
  const [stateLogIn, formActionLogIn, isPendingLogIn] = React.useActionState(
    logInGithub,
    {}
  );

  return (
    <form className="w-full">
      <input type="hidden" name="redirectCode" value={redirectCode} />
      <Button
        formAction={formActionLogIn}
        className="w-full flex items-center justify-center gap-2"
        variant="outline"
        disabled={isPendingLogIn}
      >
        <SiGithub size={24} className="text-foreground" />
        Continue with GitHub
      </Button>
      {stateLogIn.error && <p>{stateLogIn.error}</p>}
    </form>
  );
}
