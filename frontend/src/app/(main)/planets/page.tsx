import Container from "@/components/ui/container";
import { Stack } from "@/components/ui/stack";

export default function Planets() {
  return (
    <Container>
      <Stack direction="col" gap={4} className="py-8" alignItems="start">
        <h1 className="text-3xl font-bold">Planets of Our Solar System</h1>
        <p className="text-lg text-muted-foreground">
          Here is a list of the planets orbiting our Sun, ordered by their
          distance from the Sun.
        </p>
        <ul className="list-disc space-y-2 pl-6 text-lg">
          <li>Mercury</li>
          <li>Venus</li>
          <li>Earth</li>
          <li>Mars</li>
          <li>Jupiter</li>
          <li>Saturn</li>
          <li>Uranus</li>
          <li>Neptune</li>
        </ul>
      </Stack>
    </Container>
  );
}
