"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import DocumentSettingsDropdown from "@/components/document-settings-dropdown";
import EditableFlexTitle from "@/components/editable-flex-title";
import LiveTable from "@/components/live-table/LiveTable";
import Container from "@/components/ui/container";

import { updateDocument } from "./actions";

interface Document {
  id: string;
  title: string;
  liveblocks_id: string;
  description: string | null;
}

interface DocumentPageClientProps {
  docId: string;
  initialDocument: Document | null;
}

export default function DocumentPageClient({
  docId,
  initialDocument,
}: DocumentPageClientProps) {
  const [document, setDocument] = useState(initialDocument);
  const router = useRouter();

  if (!document) {
    return (
      <Container>
        <div className="mt-14 text-center">
          <h2 className="text-2xl font-bold">Document not found</h2>
          <p className="text-muted-foreground">
            The document you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>
      </Container>
    );
  }

  const pageTitle = document.title;
  const pageDescription =
    document.description ||
    `Live collaborative table for document ${document.title}.`;
  const documentTitleForPrompt = document.title;

  const handleUpdate = async (updates: {
    title?: string;
    description?: string;
  }) => {
    const result = await updateDocument(docId, updates);

    if (result.error) {
      throw new Error(result.error);
    }

    setDocument((prev) => (prev ? { ...prev, ...updates } : prev));
    router.refresh();
  };

  return (
    <Container>
      <DocumentSettingsDropdown docId={docId} documentTitle={document.title} />
      <EditableFlexTitle
        title={pageTitle}
        description={pageDescription}
        onUpdate={handleUpdate}
      />
      <LiveTable
        tableId={document.liveblocks_id}
        documentTitle={documentTitleForPrompt}
        documentDescription={pageDescription}
        docId={docId}
      />
    </Container>
  );
}
