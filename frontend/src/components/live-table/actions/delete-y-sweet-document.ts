/**
 * Only deletes the document from the database. We'll have to clean up y-sweet
 * later via another process.
 */

"use server";

import { createClient } from "@/utils/supabase/server";

export async function getDocumentById(docId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("document")
    .select("id, title, liveblocks_id, ysweet_id, description")
    .eq("id", docId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch document: ${error.message}`);
  }

  return data;
}

export async function deleteYSweetDocument(docId: string): Promise<{
  success?: boolean;
  error?: string;
}> {
  if (!process.env.Y_SWEET_CONNECTION_STRING) {
    return { error: "Server configuration error." };
  }

  try {
    const supabase = await createClient();

    const document = await getDocumentById(docId);

    if (!document.ysweet_id) {
      return { error: "Document does not have a Y-Sweet ID." };
    }

    const { error: dbError } = await supabase
      .from("document")
      .delete()
      .eq("id", docId);

    if (dbError) {
      return { error: `Failed to delete document: ${dbError.message}` };
    }

    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      return { error: `Failed to delete document: ${error.message}` };
    }
    return { error: "An unknown error occurred while deleting the document." };
  }
}
