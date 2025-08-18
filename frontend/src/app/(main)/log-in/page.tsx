import Container from "@/components/ui/container";
import { Stack } from "@/components/ui/stack";

import EmailLogIn from "./email-login";
import { GitHubLoginButton } from "./github-login-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectCode: string }>;
}) {
  const redirectCode = (await searchParams).redirectCode;

  return (
    <Container>
      <Stack
        direction="col"
        gap={4}
        alignItems="center"
        className="w-full max-w-sm mx-auto"
      >
        <h1 className="text-2xl font-bold">Log In to Brainshare</h1>
        <GitHubLoginButton redirectCode={redirectCode} />
        {process.env.NODE_ENV === "development" && (
          <EmailLogIn redirectCode={redirectCode} />
        )}
      </Stack>
    </Container>
  );
}
