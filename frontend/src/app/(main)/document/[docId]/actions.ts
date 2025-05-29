"use server";

import { createClient } from "@/utils/supabase/server";

export async function getDocumentById(docId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("document")
    .select("id, title")
    .eq("id", docId)
    .single();

  if (error) {
    console.error("Error fetching document by ID:", error);
    throw new Error(`Failed to fetch document: ${error.message}`);
  }

  return data;
}
