import Container from "@/components/ui/container";
import { Stack } from "@/components/ui/stack";

import PlanetEditor from "./PlanetEditor";
import Room from "./Room";

export default function Planets() {
  return (
    <Container>
      <Stack direction="col" gap={4} className="py-8" alignItems="start">
        <h1 className="text-3xl font-bold">Planets of Our Solar System</h1>
        <p className="text-lg text-muted-foreground">
          Here is a list of the planets orbiting our Sun, ordered by their
          distance from the Sun.
        </p>
        <Room roomId="planet-editor">
          <PlanetEditor />
        </Room>
      </Stack>
    </Container>
  );
}
