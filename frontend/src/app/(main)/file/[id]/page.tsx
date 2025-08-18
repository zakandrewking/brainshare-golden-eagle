import FilePreview from "@/blocks/files/file-preview";
import ShouldLogIn from "@/components/should-log-in";
import Container from "@/components/ui/container";
import { getUser } from "@/utils/supabase/server";

interface FilePageProps {
  params: Promise<{ id: string }>;
}

export default async function FilePage({ params }: FilePageProps) {
  const { id } = await params;
  const { user } = await getUser();

  if (!user) {
    return (
      <ShouldLogIn
        icon="files"
        message="You need to log in to upload and manage files. Sign in to get started."
        title="Files"
        redirect={`/files/${id}`}
      />
    );
  }

  return (
    <Container className="mt-12">
      <FilePreview id={id} />
    </Container>
  );
}
