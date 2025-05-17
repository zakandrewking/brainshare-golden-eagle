import LiveTable from "@/components/live-table/LiveTable";
import Container from "@/components/ui/container";
import { InternalLink } from "@/components/ui/link";

export default function Planets() {
  return (
    <Container>
      <InternalLink
        href="/moons"
        variant="outline"
        size="sm"
        className="absolute top-4 right-4"
      >
        Next: some moons
      </InternalLink>
      <div className="mt-12 ml-4">
        <h1 className="text-3xl font-bold">Planets of Our Solar System</h1>
        <p className="text-lg text-muted-foreground">
          Here is a list of the planets orbiting our Sun, ordered by their
          distance from the Sun.
        </p>
      </div>
      <LiveTable tableId="planet-editor" />
    </Container>
  );
}
