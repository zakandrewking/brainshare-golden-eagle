import { Files, LogIn } from "lucide-react";

import { logInRedirect } from "@/utils/url";

import Container from "./ui/container";
import { InternalLink } from "./ui/link";
import { Stack } from "./ui/stack";

/**
 * Use in server component page files like:
 *
 * ```tsx
 * export default async function Page() {
 *   const { user } = await getUser();
 *   if (!user) {
 *     return <ShouldLogIn />;
 *   }
 *   return ...
 */
export default function ShouldLogIn({
  icon,
  message,
  title,
  redirect,
}: {
  icon: "files";
  message: string;
  title: string;
  redirect: string;
}) {
  return (
    <Container className="flex items-center justify-center min-h-[50vh] w-full">
      <Stack
        direction="col"
        gap={4}
        alignItems="center"
        className="text-center w-full"
      >
        {icon === "files" && (
          <Files className="w-16 h-16 text-muted-foreground" />
        )}
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground max-w-md">{message}</p>
        <InternalLink href={logInRedirect(redirect)} variant="default">
          <LogIn className="mr-2 h-4 w-4" />
          Log In
        </InternalLink>
      </Stack>
    </Container>
  );
}
