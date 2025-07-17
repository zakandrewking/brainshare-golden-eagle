import { Files, LogIn } from "lucide-react";

import FileList from "@/components/blocks/files/file-list";
import FileUploader from "@/components/blocks/files/file-uploader";
import Container from "@/components/ui/container";
import { InternalLink } from "@/components/ui/link";
import { Stack } from "@/components/ui/stack";
import { getUser } from "@/utils/supabase/server";
import { logInRedirect } from "@/utils/url";

export default async function FilesPage() {
  const { user } = await getUser();

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
          <InternalLink href={logInRedirect("/files")} variant="default">
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
        <FileUploader isOverLimit={false} />
        <FileList />
      </Stack>
    </Container>
  );
}
