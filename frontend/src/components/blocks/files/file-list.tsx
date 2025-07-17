import { Stack } from "@/components/ui/stack";
import { createClient } from "@/utils/supabase/server";

export default async function FileList() {
  const supabase = await createClient();

  const { data: files, error } = await supabase.from("file").select("*");

  if (error) {
    console.error(error);
    return <div>Error loading files</div>;
  }

  if (files?.length === 0) {
    return <div>No files found</div>;
  }

  return (
    <Stack direction="col" gap={4}>
      {files?.map((file) => (
        <div key={file.id}>{file.name}</div>
      ))}
    </Stack>
  );
}
