import FileList from "@/components/blocks/files/file-list";
import FileUploader from "@/components/blocks/files/file-uploader";
import ShouldLogIn from "@/components/should-log-in";
import Container from "@/components/ui/container";
import { getUser } from "@/utils/supabase/server";

export default async function FilesPage() {
  const { user } = await getUser();

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

  return (
    <Container gap={6}>
      <h1 className="text-2xl font-bold">Files</h1>
      <div>
        <FileUploader isOverLimit={false} />
      </div>
      <FileList />
    </Container>
  );
}
