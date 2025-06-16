import FlexTitle from "@/components/flex-title";
import LiveTable from "@/components/live-table/LiveTable";
import Container from "@/components/ui/container";

export default function Moons() {
  const pageTitle = "Moons of Our Solar System";
  const pageDescription = "Here is a list of the moons orbiting our planets.";

  return (
    <Container>
      <FlexTitle title={pageTitle} description={pageDescription} />
      <LiveTable
        tableId="moons"
        documentTitle={pageTitle}
        documentDescription={pageDescription}
        docId="moons-fake-uuid"
        backend="ysweet"
      />
    </Container>
  );
}
