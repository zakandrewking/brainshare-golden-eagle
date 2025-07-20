import EmptyScreen from "@/components/empty-screen";
import Container from "@/components/ui/container";
import NavigationHeaderTitle from "@/components/ui/navigation-header-title";

export default async function HomePage() {
  return (
    <>
      <NavigationHeaderTitle />
      <main>
        <Container className="mt-0">
          <EmptyScreen />
        </Container>
      </main>
    </>
  );
}
