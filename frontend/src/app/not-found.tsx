import Container from "@/components/ui/container";
import { InternalLink } from "@/components/ui/link";
import NavigationHeader from "@/components/ui/navigation-header";

export default function NotFound() {
  return (
    <>
      <NavigationHeader />
      <main>
        <Container>
          <h1 className="text-4xl font-bold">404 - Page Not Found</h1>
          <p className="text-xl text-muted-foreground mb-4">
            Sorry, we couldn&apos;t find the page you&apos;re looking for.
          </p>
          <InternalLink href="/" variant="default">
            Return Home
          </InternalLink>
        </Container>
      </main>
    </>
  );
}
