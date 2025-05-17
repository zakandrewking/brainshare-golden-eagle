import { EmptyScreen } from "@/components/empty-screen";
import Container from "@/components/ui/container";
import NavigationHeaderTitle from "@/components/ui/navigation-header-title";
import { Stack } from "@/components/ui/stack";

export default async function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavigationHeaderTitle />
      <main className="flex-grow flex flex-col">
        <Container>
          <Stack
            direction="col"
            alignItems="center"
            className="w-full"
            gap={10}
          >
            <EmptyScreen />
          </Stack>
        </Container>
      </main>
    </div>
  );
}
