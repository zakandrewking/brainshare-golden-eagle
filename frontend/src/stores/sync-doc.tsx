import { useEffect } from "react";

import useSWR from "swr";

import { useSetDocumentDescription, useSetDocumentTitle } from "./data-store";

export default function SyncDocumentTitleAndDescription(): React.ReactNode {
  const { data } = useSWR(
    "documentTitleAndDescription",
    () => {
      // This fetcher returns static data. In a real scenario, it might be async.
      return { title: "test", description: "test" };
    },
    {
      // Provide fallbackData to ensure 'data' is not undefined initially
      fallbackData: { title: "", description: "" },
    }
  );

  // 'data' is now guaranteed to be of type { title: string; description: string; }
  const { title, description } = data;

  const setDocumentTitle = useSetDocumentTitle();
  const setDocumentDescription = useSetDocumentDescription();
  useEffect(() => {
    if (title) {
      setDocumentTitle(title);
    }
  }, [title, setDocumentTitle]);
  useEffect(() => {
    if (description) {
      setDocumentDescription(description);
    }
  }, [description, setDocumentDescription]);
  return null;
}
