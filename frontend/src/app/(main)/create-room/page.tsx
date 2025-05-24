import FlexTitle from "@/components/flex-title";
import Container from "@/components/ui/container";
import { Stack } from "@/components/ui/stack";

export default function CreateRoom() {
  return (
    <Container>
      <FlexTitle
        title="Create a room"
        description="An open space to collaborate and jot down ideas"
      />
      <Stack direction="col" className="w-full h-128" alignItems="center">
        <div className="border p-4 rounded-lg flex flex-col items-center justify-center">
          <p
            style={{
              fontSize: "1.5rem",
              fontWeight: "bold",
              marginBottom: "0.5rem",
            }}
          >
            🚧 🛠️ 👷 Under Construction! 👷 🛠️ 🚧
          </p>
          <p
            style={{ fontSize: "1.1rem", color: "#555", marginBottom: "1rem" }}
          >
            This page is currently being built with 90s enthusiasm!
            <br />
            Please check back later for some digital magic! ✨
          </p>
          <p
            style={{
              fontSize: "2.5rem",
              marginTop: "1rem",
              letterSpacing: "0.2em",
              lineHeight: "1",
            }}
          >
            🚧🚧🚧
          </p>
        </div>
      </Stack>
    </Container>
  );
}
