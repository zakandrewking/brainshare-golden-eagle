import "./globals.css";

import { ReactNode } from "react";

import HolyLoader from "holy-loader";
import { type Metadata } from "next";

import { fontOrbitron, fontSans } from "@/components/fonts";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/utils/tailwind";

export const metadata: Metadata = {
  title: "Brainshare",
  description: "Why screenshare when you can brainshare?",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* https://github.com/tomcru/holy-loader/issues/2 */}
      {/* color from globals.css:root:input */}
      <HolyLoader height={2} color="#738c7b" />
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no"
        />
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased overscroll-none",
          fontSans.variable,
          fontOrbitron.variable
        )}
      >
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
