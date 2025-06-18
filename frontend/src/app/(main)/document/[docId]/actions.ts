"use server";

import { deleteLiveblocksRoom } from "@/app/(main)/document/new/actions";
import { createClient } from "@/utils/supabase/server";

export async function getDocumentById(docId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("document")
    .select("id, title, liveblocks_id, ysweet_id, description")
    .eq("id", docId)
    .single();

  if (error) {
    console.error("Error fetching document by ID:", error);
    throw new Error(`Failed to fetch document: ${error.message}`);
  }

  return data;
}

export async function deleteDocument(docId: string): Promise<{
  success?: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const document = await getDocumentById(docId);

    const { error: dbError } = await supabase
      .from("document")
      .delete()
      .eq("id", docId);

    if (dbError) {
      console.error("Error deleting document from database:", dbError);
      return { error: `Failed to delete document: ${dbError.message}` };
    }

    const liveblocksResult = await deleteLiveblocksRoom(document.liveblocks_id);

    if (!liveblocksResult.success) {
      console.error("Error deleting Liveblocks room:", liveblocksResult.error);
      return {
        error: `Document deleted but failed to clean up associated room: ${liveblocksResult.error}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting document:", error);
    if (error instanceof Error) {
      return { error: `Failed to delete document: ${error.message}` };
    }
    return { error: "An unknown error occurred while deleting the document." };
  }
}

export async function updateDocument(
  docId: string,
  updates: { title?: string; description?: string }
): Promise<{
  success?: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("document")
      .update(updates)
      .eq("id", docId);

    if (error) {
      console.error("Error updating document:", error);
      return { error: `Failed to update document: ${error.message}` };
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating document:", error);
    if (error instanceof Error) {
      return { error: `Failed to update document: ${error.message}` };
    }
    return { error: "An unknown error occurred while updating the document." };
  }
}
