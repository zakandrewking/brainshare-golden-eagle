import FlexTitle from "@/components/flex-title";
import Container from "@/components/ui/container";

import CreateDocumentView from "./view";

export default function CreateDocument() {
  return (
    <Container className="mt-0">
      <FlexTitle
        title="Create a document"
        description="An open space to collaborate and jot down ideas"
      />
      <CreateDocumentView />
    </Container>
  );
}
