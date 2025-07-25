// more auth examples in zakandrewking/brainshare project

import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";
import { Session, User } from "@supabase/supabase-js";

import { Database } from "@/database.types";

const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_API_URL;
if (!anonKey) {
  throw Error("Missing environment variable NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
if (!apiUrl) {
  throw Error("Missing environment variable NEXT_PUBLIC_SUPABASE_API_URL");
}

/**
 * Supabase client for server components.
 *
 * To verify that the user is logged in, use:
 *
 * ```tsx
 * const { data: { user } } = await supabase.auth.getUser()
 * if (!user) {
 *   return <div>You must be logged in to view this page.</div>;
 * }
 * ```
 */
export async function createClient() {
  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(apiUrl!, anonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });

  return supabase;
}

export async function createClientWithToken(token: string) {
  const supabase = createServerClient<Database>(apiUrl!, anonKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    cookies: {
      getAll() {
        return [];
      },
      setAll() {},
    },
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });

  return supabase;
}

export async function WithUser({
  children,
}: {
  children: (user: User | null, session: Session | null) => React.ReactNode;
}) {
  const { user, session } = await getUser();
  return children(user, session);
}

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // always get the session after running getUser
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { supabase, user, session };
}
