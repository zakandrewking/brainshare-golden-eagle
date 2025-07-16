"use client";

import { Files, LogIn } from "lucide-react";
import { usePathname } from "next/navigation";

import Container from "@/components/ui/container";
import { InternalLink } from "@/components/ui/link";
import { Stack } from "@/components/ui/stack";
import { useUser } from "@/utils/supabase/client";
import { logInRedirect } from "@/utils/url";

export default function FilesPage() {
  const user = useUser();
  const pathname = usePathname();

  if (!user) {
    return (
      <Container className="flex items-center justify-center min-h-[50vh] w-full">
        <Stack
          direction="col"
          gap={4}
          alignItems="center"
          className="text-center w-full"
        >
          <Files className="w-16 h-16 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Files</h1>
          <p className="text-muted-foreground max-w-md">
            You need to log in to upload and manage files. Sign in to get
            started.
          </p>
          <InternalLink href={logInRedirect(pathname)} variant="default">
            <LogIn className="mr-2 h-4 w-4" />
            Log In
          </InternalLink>
        </Stack>
      </Container>
    );
  }

  return (
    <Container>
      <Stack direction="col" gap={4} alignItems="start">
        <h1 className="text-2xl font-bold">Files</h1>
        <p className="text-muted-foreground">
          File management functionality will be implemented here.
        </p>
      </Stack>
    </Container>
  );
}
