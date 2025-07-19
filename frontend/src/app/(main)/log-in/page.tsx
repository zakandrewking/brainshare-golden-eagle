"use client";

import React from "react";

import { useSearchParams } from "next/navigation";

// import { logIn } from "@/components/auth/actions/log-in";
// import { signUp } from "@/components/auth/actions/sign-up";
import { GitHubLoginButton } from "@/components/auth/github-login-button";
import Container from "@/components/ui/container";
import { Stack } from "@/components/ui/stack";

export default function LoginPage() {
  const searchParams = useSearchParams();
  // const [stateLogIn, formActionLogIn, isPendingLogIn] = React.useActionState(
  //   logIn,
  //   {}
  // );
  // const [stateSignUp, formActionSignUp, isPendingSignUp] = React.useActionState(
  //   signUp,
  //   {}
  // );
  const redirectCode = searchParams.get("redirectCode") ?? "";
  // const isPending = isPendingLogIn || isPendingSignUp;

  return (
    <Container>
      <Stack
        direction="col"
        gap={4}
        alignItems="center"
        className="w-full max-w-sm mx-auto"
      >
        <h1 className="text-2xl font-bold">Log In to Brainshare</h1>

        <GitHubLoginButton redirectCode={redirectCode} />

        {/* dev email/pass login flow is not working yet */}
        {/* {process.env.NODE_ENV === "development" && (
          <>
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>

            <form className="w-full">
              <Stack direction="col" gap={2} alignItems="start">
                <input type="hidden" name="redirectCode" value={redirectCode} />
                <label htmlFor="email">Email:</label>
                <Input id="email" name="email" type="email" required />
                <label htmlFor="password">Password:</label>
                <Input id="password" name="password" type="password" required />
                <Button formAction={formActionLogIn} disabled={isPending}>
                  Log in
                </Button>
                <Button formAction={formActionSignUp} disabled={isPending}>
                  Sign up
                </Button>
                {stateLogIn.error && <p>{stateLogIn.error}</p>}
                {stateSignUp.error && <p>{stateSignUp.error}</p>}
              </Stack>
            </form>
          </>
        )} */}
      </Stack>
    </Container>
  );
}
