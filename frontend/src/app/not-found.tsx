import Link from "next/link";

import { Button } from "@/components/ui/button";
import Container from "@/components/ui/container";
import NavigationHeader from "@/components/ui/navigation-header";

export default function NotFound() {
  return (
    <div className="flex flex-col">
      <NavigationHeader />
      <main className="flex-grow flex flex-col">
        <Container className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
          <h1 className="text-4xl font-bold">404 - Page Not Found</h1>
          <p className="text-xl text-muted-foreground mb-4">
            Sorry, we couldn&apos;t find the page you&apos;re looking for.
          </p>
          <Button asChild>
            <Link href="/">Return Home</Link>
          </Button>
        </Container>
      </main>
    </div>
  );
}
