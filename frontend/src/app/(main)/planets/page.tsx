import FlexTitle from "@/components/flex-title";
import LiveTable from "@/components/live-table/LiveTable";
import Container from "@/components/ui/container";
import { InternalLink } from "@/components/ui/link";

export default function Planets() {
  const pageTitle = "Planets of Our Solar System";
  const pageDescription =
    "Here is a list of the planets orbiting our Sun, ordered by their distance from the Sun.";

  return (
    <Container>
      <InternalLink
        href="/moons"
        variant="outline"
        size="sm"
        className="absolute top-3 right-3"
      >
        Next: some moons
      </InternalLink>
      <FlexTitle title={pageTitle} description={pageDescription} />
      <LiveTable
        tableId="planet-editor"
        documentTitle={pageTitle}
        documentDescription={pageDescription}
        docId="planets-fake-uuid"
      />
    </Container>
  );
}
