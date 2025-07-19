import Chat from "@/components/blocks/chat/chat";
import ChatList from "@/components/blocks/chat/chat-list";
import Container from "@/components/ui/container";

export default function ChatPage() {
  return (
    <Container>
      <ChatList />
      <Chat />
    </Container>
  );
}
