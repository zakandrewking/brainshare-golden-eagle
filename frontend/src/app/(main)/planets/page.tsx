import Room from "@/components/live-table/Room";
import Container from "@/components/ui/container";
import { InternalLink } from "@/components/ui/link";
import { Stack } from "@/components/ui/stack";

import PlanetEditor from "./PlanetEditor";

export default function Planets() {
  return (
    <Container>
      <Stack direction="col" gap={4} className="py-8 w-full" alignItems="start">
        <Stack
          direction="row"
          gap={4}
          alignItems="start"
          justifyContent="between"
          className="w-full"
        >
          <div>
            <h1 className="text-3xl font-bold">Planets of Our Solar System</h1>
            <p className="text-lg text-muted-foreground">
              Here is a list of the planets orbiting our Sun, ordered by their
              distance from the Sun.
            </p>
          </div>
          <InternalLink href="/moons" variant="outline">
            Next: some moons
          </InternalLink>
        </Stack>
        <Room roomId="planet-editor">
          <PlanetEditor />
        </Room>
      </Stack>
    </Container>
  );
}
