"use client";

import Link from "next/link";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";

export default function Home() {
  const { authenticated } = useRequireAuth();
  const { user } = useAuth();

  if (!authenticated) return null;

  return (
    <AppShell>
      <main className="flex flex-col items-center justify-center gap-8 p-8 pt-24">
        <h1 className="text-4xl font-bold tracking-tight">
          Interface Environmental
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-md text-center">
          Welcome back, {user?.name}
        </p>
        <div className="flex gap-4">
          <Link
            href="/projects"
            className="rounded-lg bg-emerald-600 px-6 py-3 text-white font-medium hover:bg-emerald-700 transition-colors"
          >
            Projects
          </Link>
          <Link
            href="/clients"
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-6 py-3 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Clients
          </Link>
        </div>
      </main>
    </AppShell>
  );
}
