import React from "react";

import { SearchProvider } from "@/components/global-search-provider";
// import { BackendProvider } from "@/components/backend/backend-provider";
import { ThemeProvider } from "@/components/theme-provider";

// import { TooltipProvider } from "@/components/ui/tooltip";
// import ConfigProvider from "@/config/ConfigProvider";
// import { IdentificationStoreProvider } from "@/stores/identification-store";
// import { WidgetStoreProvider } from "@/stores/widget-store";
// import { UserProvider } from "@/utils/supabase/client";
// import { WithUser } from "@/utils/supabase/server";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <SearchProvider>{children}</SearchProvider>
    </ThemeProvider>
  );
}

// <WithUser
//   children={(user, session) => (
//     <BackendProvider session={session}>
//       <IdentificationStoreProvider user={user}>
//         <WidgetStoreProvider user={user}>
//           <UserProvider user={user}>
//             <ConfigProvider>
//               <TooltipProvider>
//           </TooltipProvider>
//         </ConfigProvider>
//       </UserProvider>
//     </WidgetStoreProvider>
//   </IdentificationStoreProvider>
// </BackendProvider>
