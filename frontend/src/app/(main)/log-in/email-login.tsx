"use client";

import React from "react";

import { logInEmail } from "@/components/auth/actions/log-in-email";

export default function EmailLogIn({ redirectCode }: { redirectCode: string }) {
  const [stateLogIn, formActionLogIn, isPendingLogIn] = React.useActionState(
    logInEmail,
    {}
  );

  return (
    <div className="mx-auto w-full max-w-md">
      <form
        className="grid gap-3 rounded-lg border bg-card p-4 shadow-sm"
        action={formActionLogIn}
      >
        <input type="hidden" name="redirectCode" value={redirectCode} />
        <div className="grid gap-2">
          <label className="text-sm" htmlFor="email">
            Email
          </label>
          <input
            name="email"
            type="email"
            required
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-0 transition-shadow focus-visible:ring-2"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm" htmlFor="password">
            Password
          </label>
          <input
            name="password"
            type="password"
            required
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-0 transition-shadow focus-visible:ring-2"
          />
        </div>
        {stateLogIn.error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
            {stateLogIn.error}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isPendingLogIn}
            className="inline-flex items-center justify-center gap-2 rounded-md border bg-foreground px-3 py-2 text-sm font-medium text-background shadow-sm disabled:opacity-50"
          >
            Sign In
          </button>
        </div>
      </form>
    </div>
  );
}
