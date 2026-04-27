"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SideNav } from "./side-nav";
import { Logo } from "./logo";
import { useAuth } from "@/lib/auth-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sideOpen, setSideOpen] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && !user.isAdmin) {
      router.replace("/mobile");
    }
  }, [loading, user, router]);

  if (loading || (user && !user.isAdmin)) return null;

  return (
    <div className="min-h-screen">
      <SideNav open={sideOpen} onClose={() => setSideOpen(false)} />

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/80 px-4 backdrop-blur dark:border-gray-700 dark:bg-gray-900/80 md:hidden">
        <button
          onClick={() => setSideOpen(true)}
          className="rounded-md p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Open menu"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <Logo className="h-7 w-7" />
        <span className="text-sm font-bold tracking-tight">
          Interface Environmental
        </span>
      </div>

      <main className="md:pl-64">{children}</main>
    </div>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
