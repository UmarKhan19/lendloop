"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LoadingPanel } from "./PageStates";

export default function RequireAuth({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <>
      <AuthLoading>
        <LoadingPanel label="Checking your session…" />
      </AuthLoading>

      <Unauthenticated>
        <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
          <section className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-10">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
              Members only
            </p>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {description}
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <SignInButton forceRedirectUrl={pathname}>
                <button
                  type="button"
                  className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton forceRedirectUrl={pathname}>
                <button
                  type="button"
                  className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Create account
                </button>
              </SignUpButton>
            </div>
          </section>
        </main>
      </Unauthenticated>

      <Authenticated>{children}</Authenticated>
    </>
  );
}
