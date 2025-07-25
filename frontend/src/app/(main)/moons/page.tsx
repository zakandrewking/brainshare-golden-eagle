import FlexTitle from "@/components/flex-title";
import LiveTable from "@/components/live-table/LiveTable";
import Container from "@/components/ui/container";

export default function Moons() {
  const pageTitle = "Moons of Our Solar System";
  const pageDescription = "Here is a list of the moons orbiting our planets.";

  return (
    <Container className="mt-0">
      <FlexTitle title={pageTitle} description={pageDescription} />
      <LiveTable
        tableId="moons"
        documentTitle={pageTitle}
        documentDescription={pageDescription}
        docId="moons"
        backend="ysweet"
      />
    </Container>
  );
}
