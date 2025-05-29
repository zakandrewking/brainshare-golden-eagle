import DocumentSettingsDropdown from "@/components/document-settings-dropdown";
import FlexTitle from "@/components/flex-title";
import LiveTable from "@/components/live-table/LiveTable";
import Container from "@/components/ui/container";

import { getDocumentById } from "./actions";

interface DocumentPageProps {
  params: Promise<{ docId: string }>;
}

export default async function DocumentPage({
  params,
}: DocumentPageProps) {
  const { docId } = await params;
  const document = await getDocumentById(docId);
  const pageTitle = document ? `Document: ${document.title}` : `Document: ${docId}`;
  const pageDescription = document
    ? `Live collaborative table for document ${document.title}.`
    : `Live collaborative table for document ${docId}.`;

  const documentTitleForPrompt = document?.title ?? docId;
  const documentDescriptionForPrompt = document ? `Live collaborative table for document ${document.title}.` : `Live collaborative table for document ${docId}.`;

  return (
    <Container>
      <DocumentSettingsDropdown
        docId={docId}
        documentTitle={document?.title}
      />
      <FlexTitle title={pageTitle} description={pageDescription} />
      <LiveTable tableId={docId} documentTitle={documentTitleForPrompt} documentDescription={documentDescriptionForPrompt} />
    </Container>
  );
}
