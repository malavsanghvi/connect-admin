"use server";

import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/session";
import { fail, ok, type ActionResult } from "@/lib/result";

function cleanEmail(value: FormDataEntryValue | null): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export async function sendCode(formData: FormData): Promise<ActionResult<{ email: string }>> {
  const email = cleanEmail(formData.get("email"));
  if (!email) return fail("Enter a valid email address, like name@example.com.");
  const supabase = await getSupabase();
  // shouldCreateUser: false — the console is only for people the center has
  // already set up; it must not mint new accounts.
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) {
    console.error("[login] signInWithOtp failed", error);
    const msg = error.message.toLowerCase();
    if (msg.includes("signups not allowed") || msg.includes("not found")) {
      return fail(
        "We couldn't find a Connect login for that email. Use the email the office has on file, or ask the office to set you up.",
      );
    }
    if (error.status === 429 || msg.includes("rate limit") || msg.includes("security purposes")) {
      return fail("Too many codes were requested. Wait a minute, then try again.");
    }
    return fail(`We couldn't send a code right now (${error.message}). Please try again.`);
  }
  return ok(`We sent a code to ${email}.`, { email });
}

function safeNext(value: FormDataEntryValue | null): string {
  const next = String(value ?? "");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function verifyCode(formData: FormData): Promise<ActionResult> {
  const email = cleanEmail(formData.get("email"));
  const token = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!email) return fail("Your email is missing. Go back and enter it again.");
  if (!/^\d{6,10}$/.test(token)) return fail("Enter the code from the email (numbers only).");
  const supabase = await getSupabase();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    console.error("[login] verifyOtp failed", error);
    const msg = error.message.toLowerCase();
    if (msg.includes("expired") || msg.includes("invalid")) {
      return fail("That code is wrong or has expired. Check the latest email, or send a new code.");
    }
    return fail(`We couldn't sign you in (${error.message}). Please try again.`);
  }
  redirect(safeNext(formData.get("next")));
}

export async function signOut(): Promise<ActionResult> {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("[login] signOut failed", error);
    return fail(`We couldn't sign you out (${error.message}). Close the browser to end the session, or try again.`);
  }
  redirect("/login");
}
