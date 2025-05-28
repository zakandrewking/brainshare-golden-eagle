import FlexTitle from "@/components/flex-title";
import LiveTable from "@/components/live-table/LiveTable";
import Container from "@/components/ui/container";

interface DocumentPageProps {
  params: {
    "doc-id": string;
  };
}

export default function DocumentPage({ params }: DocumentPageProps) {
  const docId = params["doc-id"];
  const pageTitle = `Document: ${docId}`;
  const pageDescription = `Live collaborative table for document ${docId}.`;

  return (
    <Container>
      <FlexTitle title={pageTitle} description={pageDescription} />
      <LiveTable tableId={docId} />
    </Container>
  );
}
