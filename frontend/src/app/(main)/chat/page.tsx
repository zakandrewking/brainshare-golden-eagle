import ChatList from "@/components/blocks/chat/chat-list";
import ShouldLogIn from "@/components/should-log-in";
import Container from "@/components/ui/container";
import { getUser } from "@/utils/supabase/server";

import BroadcastTest from "./broadcast-test";

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
      <div className="h-10" />
      <BroadcastTest />
      <div className="h-10" />
      <ChatList />
    </Container>
  );
}
