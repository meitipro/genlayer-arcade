import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { safeNext } from "@/lib/loginState";
import { readSessionCookie, SESSION_COOKIE } from "@/lib/sessionCookie";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in", description: "GenLayer Arcade needs a Discord login." };

const ERRORS: Record<string, string> = {
  cancelled: "Discord sign-in was cancelled.",
  expired: "That sign-in link expired or did not start here. Start again.",
  failed: "Discord did not answer as expected. Try again in a minute.",
  "slow-down": "Too many attempts. Wait a minute and try again.",
  "not-configured": "Discord sign-in is not set up on this site yet.",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  // someone who is already signed in has no reason to be here
  const session = await readSessionCookie((await cookies()).get(SESSION_COOKIE)?.value);
  if (session) redirect(next);
  const error = sp.error ? ERRORS[sp.error] : null;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <p className="mono text-xs uppercase tracking-widest text-accent">community gaming hub</p>
      <h1 className="text-[44px] font-bold leading-[1.05] sm:text-[56px]">Sign in with Discord</h1>
      <p className="max-w-md text-muted">
        GenLayer Arcade is for members of the GenLayer community. Your Discord account is your player: it sets your name on the boards and your tier from your roles in the GenLayer server.
      </p>
      {error && (
        <p className="card w-full p-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <a className="btn btn-primary min-w-64" href={`/api/discord/login?next=${encodeURIComponent(next)}`}>
        Continue with Discord
      </a>
      <p className="max-w-md text-xs text-muted">
        We read your Discord id, name, picture and your roles in the GenLayer server. Nothing is posted and no password is involved. Linking an X account is optional and happens later on My Card.
      </p>
    </div>
  );
}
