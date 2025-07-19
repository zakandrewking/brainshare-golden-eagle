import { createClient } from "@/utils/supabase/client";

export async function deleteFile(fileId: string) {
  const supabase = createClient();

  const { data: fileData, error: fileError } = await supabase
    .from("file")
    .select("bucket_id, object_path, name")
    .eq("id", fileId)
    .single();

  if (fileError || !fileData) {
    console.error("Error fetching file details:", fileError);
    throw new Error("File not found");
  }

  const { error: storageError } = await supabase.storage
    .from(fileData.bucket_id)
    .remove([fileData.object_path]);

  if (storageError) {
    console.error("Error deleting file from storage:", storageError);
    throw new Error("Failed to delete file from storage");
  }

  const { error: dbError } = await supabase
    .from("file")
    .delete()
    .eq("id", fileId);

  if (dbError) {
    console.error("Error deleting file from database:", dbError);
    throw new Error("Failed to delete file from database");
  }
}
