"use client";

import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <section className="w-full max-w-2xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-12">
        <header className="flex items-center justify-between">
          <span className="text-lg font-semibold tracking-tight">lendloop</span>
          <div className="flex items-center gap-3">
            <Unauthenticated>
              <SignInButton>
                <button className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton>
                <button className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200">
                  Create account
                </button>
              </SignUpButton>
            </Unauthenticated>
            <Authenticated>
              <UserButton />
            </Authenticated>
          </div>
        </header>

        <div className="mt-20 space-y-5 sm:mt-28">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
            Your app starts here
          </p>
          <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Welcome to Lendloop.
          </h1>
          <p className="max-w-lg text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Next.js, Clerk authentication, and a real-time Convex backend are
            connected and ready for your product.
          </p>

          <AuthLoading>
            <p className="text-sm text-zinc-500">Connecting your session…</p>
          </AuthLoading>
          <Unauthenticated>
            <p className="text-sm text-zinc-500">
              Sign in to check your authenticated Convex identity.
            </p>
          </Unauthenticated>
          <Authenticated>
            <CurrentUser />
          </Authenticated>
        </div>
      </section>
    </main>
  );
}

function CurrentUser() {
  const user = useQuery(api.users.getCurrentUser);

  if (user === undefined) {
    return <p className="text-sm text-zinc-500">Loading your Convex profile…</p>;
  }

  if (user === null) {
    return <p className="text-sm text-zinc-500">No Convex identity found.</p>;
  }

  return (
    <p className="text-sm text-zinc-600 dark:text-zinc-300">
      Signed in to Convex as {user.email ?? user.name ?? user.subject}.
    </p>
  );
}
