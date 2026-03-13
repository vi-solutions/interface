"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { Logo } from "@/components/logo";

const THEME_CYCLE = ["system", "dark", "light"] as const;

export function Header() {
  const { user, logout } = useAuth();
  const { preference, resolved, setPreference } = useTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-700 dark:bg-gray-900/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold tracking-tight"
          >
            <Logo className="h-8 w-8" />
            Interface Environmental
          </Link>
          <nav className="hidden sm:flex items-center gap-4 text-sm font-medium">
            <Link
              href="/projects"
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
            >
              Projects
            </Link>
            <Link
              href="/clients"
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
            >
              Clients
            </Link>
          </nav>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 h-8 w-8 items-center justify-center text-sm font-medium hover:ring-2 hover:ring-emerald-400 transition"
            aria-label="Profile menu"
          >
            {initials}
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {user.email}
                </p>
              </div>
              <div className="p-1">
                <button
                  onClick={() => {
                    setOpen(false);
                    router.push("/profile");
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <UserIcon className="h-4 w-4" />
                  Profile Settings
                </button>
                <button
                  onClick={() => {
                    const next =
                      THEME_CYCLE[
                        (THEME_CYCLE.indexOf(preference) + 1) %
                          THEME_CYCLE.length
                      ];
                    setPreference(next);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {preference === "system" ? (
                    <MonitorIcon className="h-4 w-4" />
                  ) : resolved === "dark" ? (
                    <SunIcon className="h-4 w-4" />
                  ) : (
                    <MoonIcon className="h-4 w-4" />
                  )}
                  {preference === "system"
                    ? "System"
                    : preference === "dark"
                      ? "Dark"
                      : "Light"}
                </button>
                <button
                  onClick={() => {
                    logout();
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                >
                  <ArrowOutIcon className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path d="M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2ZM10 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15ZM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM15.657 5.404a.75.75 0 1 0-1.06-1.06l-1.061 1.06a.75.75 0 0 0 1.06 1.061l1.061-1.06ZM6.464 14.596a.75.75 0 1 0-1.06-1.06l-1.061 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM18 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 18 10ZM5 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 5 10ZM14.596 15.657a.75.75 0 0 0 1.06-1.06l-1.06-1.061a.75.75 0 1 0-1.06 1.06l1.06 1.061ZM5.404 6.464a.75.75 0 0 0 1.06-1.06l-1.06-1.061a.75.75 0 1 0-1.061 1.06l1.06 1.061Z" />
    </svg>
  );
}

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M2 4.25A2.25 2.25 0 0 1 4.25 2h11.5A2.25 2.25 0 0 1 18 4.25v8.5A2.25 2.25 0 0 1 15.75 15h-4v2h2.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5h2.5v-2H4.25A2.25 2.25 0 0 1 2 12.75v-8.5Zm2.25-.75a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h11.5a.75.75 0 0 0 .75-.75v-8.5a.75.75 0 0 0-.75-.75H4.25Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M7.455 2.004a.75.75 0 0 1 .26.77 7 7 0 0 0 9.958 7.967.75.75 0 0 1 1.067.853A8.5 8.5 0 1 1 6.647 1.921a.75.75 0 0 1 .808.083Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ArrowOutIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z"
        clipRule="evenodd"
      />
      <path
        fillRule="evenodd"
        d="M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-.943a.75.75 0 1 0-1.004-1.114l-2.5 2.25a.75.75 0 0 0 0 1.114l2.5 2.25a.75.75 0 1 0 1.004-1.114l-1.048-.943h9.546A.75.75 0 0 0 19 10Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
    </svg>
  );
}
