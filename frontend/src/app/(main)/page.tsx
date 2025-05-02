import { EmptyScreen } from "@/components/empty-screen";
import Container from "@/components/ui/container";
import { Stack } from "@/components/ui/stack";

export default async function Home() {
  return (
    <Container>
      <Stack direction="col" alignItems="center" className="w-full" gap={10}>
        <EmptyScreen />
      </Stack>
    </Container>
  );
}
