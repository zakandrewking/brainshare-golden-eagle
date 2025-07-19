import FileList from "@/components/blocks/files/file-list";
import FileUploader from "@/components/blocks/files/file-uploader";
import ShouldLogIn from "@/components/should-log-in";
import Container from "@/components/ui/container";
import { Stack } from "@/components/ui/stack";
import { getSupportedFileTypesDisplay } from "@/utils/file-types";
import { getUser } from "@/utils/supabase/server";

export default async function FilesPage() {
  const user = await getUser();

  if (!user) {
    return (
      <ShouldLogIn
        icon="files"
        message="You need to log in to upload and manage files. Sign in to get started."
        title="Files"
        redirect="/files"
      />
    );
  }

  // Placeholder values for isOverLimit and usage (to be implemented later)
  const isOverLimit = false;

  return (
    <Container gap={8}>
      <Stack direction="col" gap={4} alignItems="start" className="w-full">
        <div>
          <h2 className="text-2xl font-bold mb-2">File Upload</h2>
          <p className="text-muted-foreground mb-4">
            Upload files. We currently support: {getSupportedFileTypesDisplay()}
          </p>
        </div>
        <FileUploader isOverLimit={isOverLimit} />
      </Stack>
      <Stack direction="col" gap={2} alignItems="start" className="w-full">
        <h3 className="text-xl font-semibold">Files</h3>
        <FileList />
      </Stack>
    </Container>
  );
}
