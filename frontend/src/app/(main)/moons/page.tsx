import LiveTable from "@/components/live-table/LiveTable";
import Container from "@/components/ui/container";

export default function Moons() {
  return (
    <Container>
      <h1 className="text-3xl font-bold">Moons of Our Solar System</h1>
      <p className="text-lg text-muted-foreground">
        Here is a list of the moons orbiting our planets.
      </p>
      <LiveTable tableId="moons" />
    </Container>
  );
}
