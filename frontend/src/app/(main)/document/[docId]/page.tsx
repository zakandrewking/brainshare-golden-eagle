import { getDocumentById } from "./actions";
import DocumentPageClient from "./document-page-client";

interface DocumentPageProps {
  params: Promise<{ docId: string }>;
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { docId } = await params;

  let document = null;
  try {
    document = await getDocumentById(docId);
  } catch (error) {
    console.error("Failed to fetch document:", error);
  }

  const ysweet_id = document?.ysweet_id;
  if (!ysweet_id || !document) {
    return <div>Document not found</div>;
  }

  return (
    <DocumentPageClient
      docId={docId}
      initialDocument={{
        ...document,
        ysweet_id,
      }}
    />
  );
}
