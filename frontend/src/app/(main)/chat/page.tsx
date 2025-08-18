import ChatList from "@/blocks/chat/chat-list";
import ShouldLogIn from "@/components/should-log-in";
import Container from "@/components/ui/container";
import { getUser } from "@/utils/supabase/server";

export default async function ChatPage() {
  const { user } = await getUser();

  if (!user) {
    return (
      <ShouldLogIn
        icon="files"
        message="You need to log in to view and manage chats. Sign in to get started."
        title="Chat"
        redirect="/chat"
      />
    );
  }

  return (
    <Container>
      <ChatList />
    </Container>
  );
}
