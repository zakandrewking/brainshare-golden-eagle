import LiveTable from "@/components/live-table/LiveTable";
import Container from "@/components/ui/container";

export default function Moons() {
  return (
    <Container>
      <div className="mt-12 ml-4">
        <h1 className="text-3xl font-bold">Moons of Our Solar System</h1>
        <p className="text-lg text-muted-foreground">
          Here is a list of the moons orbiting our planets.
        </p>
      </div>
      <LiveTable tableId="moons" />
    </Container>
  );
}
