import { DebugSettings } from "@/components/debug-settings";
import Container from "@/components/ui/container";
import NavigationHeaderTitle from "@/components/ui/navigation-header-title";

export default function DebugPage() {
  return (
    <div className="flex flex-col">
      <NavigationHeaderTitle />
      <main className="flex-grow flex flex-col">
        <Container>
          <div className="max-w-2xl mx-auto py-8">
            <h1 className="text-3xl font-bold mb-2">Debug Settings</h1>
            <p className="text-muted-foreground mb-8">
              Configure debug options for development and testing.
            </p>
            <DebugSettings />
          </div>
        </Container>
      </main>
    </div>
  );
}
