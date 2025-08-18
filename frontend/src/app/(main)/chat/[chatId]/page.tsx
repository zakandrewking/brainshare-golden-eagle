import ChatDetail from "@/blocks/chat/chat-detail";
import ShouldLogIn from "@/components/should-log-in";
import Container from "@/components/ui/container";
import { getUser } from "@/utils/supabase/server";

interface ChatPageProps {
  params: Promise<{ chatId: string }>;
}

export default async function ChatDetailPage({ params }: ChatPageProps) {
  const { chatId } = await params;
  const { user } = await getUser();

  if (!user) {
    return (
      <ShouldLogIn
        icon="files"
        message="You need to log in to view and manage chats. Sign in to get started."
        title="Chat"
        redirect={`/chat/${chatId}`}
      />
    );
  }

  return (
    <Container>
      <ChatDetail chatId={chatId} />
    </Container>
  );
}
