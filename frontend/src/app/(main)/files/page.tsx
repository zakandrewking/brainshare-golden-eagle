import FileList from "@/components/blocks/files/file-list";
import FileUploader from "@/components/blocks/files/file-uploader";
import ShouldLogIn from "@/components/should-log-in";
import Container from "@/components/ui/container";
import { FILE_TYPE_DESCRIPTIONS } from "@/utils/file-types";
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
      <div>
        <h1 className="text-2xl font-bold">Files</h1>
        <div className="mt-2 p-4 bg-muted rounded-md">
          <h3 className="font-medium text-sm mb-2">Supported File Types</h3>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Currently supported:</p>
            <ul className="ml-4 space-y-0.5">
              {Object.entries(FILE_TYPE_DESCRIPTIONS).map(
                ([ext, description]) => (
                  <li key={ext}>
                    <strong>.{ext.toUpperCase()}</strong> - {description}
                  </li>
                )
              )}
            </ul>
          </div>
        </div>
      </div>
      <div>
        <FileUploader isOverLimit={false} />
      </div>
      <FileList />
    </Container>
  );
}
