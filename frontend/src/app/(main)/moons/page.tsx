import FlexTitle from "@/components/flex-title";
import LiveTable from "@/components/live-table/LiveTable";
import Container from "@/components/ui/container";

export default function Moons() {
  const pageTitle = "Moons of Our Solar System";
  const pageDescription = "Here is a list of the moons orbiting our planets.";
  return (
    <Container>
      <FlexTitle
        title={pageTitle}
        description={pageDescription}
        className="fixed top-3 left-24 right-24 z-20 !mt-0"
      />
      <LiveTable
        tableId="moons"
        documentTitle={pageTitle}
        documentDescription={pageDescription}
      />
    </Container>
  );
}
