"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { decodeRedirect } from "@/utils/url";

export async function logInEmail(
  _prevState: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const redirectCode = formData.get("redirectCode") as string;
  const redirectPath =
    redirectCode && redirectCode !== "" ? decodeRedirect(redirectCode) : null;

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    return { error: error.message };
  }

  if (redirectPath) {
    redirect(redirectPath);
  } else {
    redirect("/");
  }
}
