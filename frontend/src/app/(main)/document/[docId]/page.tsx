import FlexTitle from "@/components/flex-title";
import LiveTable from "@/components/live-table/LiveTable";
import Container from "@/components/ui/container";

interface DocumentPageProps {
  params: Promise<{ docId: string }>;
}

export default async function DocumentPage({
  params,
}: DocumentPageProps) {
  const { docId } = await params;
  const pageTitle = `Document: ${docId}`;
  const pageDescription = `Live collaborative table for document ${docId}.`;

  return (
    <Container>
      <FlexTitle title={pageTitle} description={pageDescription} />
      <LiveTable tableId={docId} />
    </Container>
  );
}
