"use client";

import useSWR from "swr";

import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

export function useDocuments() {
  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR("/api/documents", async ()=> {
    const { data, error } = await supabase
        .from("document")
        .select("id, liveblocks_id, title, type")
        .order("title", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }
    return data;
  });

  return {
    documents: data,
    isLoading,
    error: error?.message || null,
    mutateDocuments: mutate,
  };
}
