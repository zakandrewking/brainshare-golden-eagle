import React from "react";

import { SearchProvider } from "@/components/global-search-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { UserProvider } from "@/utils/supabase/client";
import { WithUser } from "@/utils/supabase/server";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WithUser
      children={(user, session) => (
        <UserProvider user={user}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SearchProvider>{children}</SearchProvider>
          </ThemeProvider>
        </UserProvider>
      )}
    />
  );
}
