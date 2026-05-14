// components/side-nav.tsx

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/logo";
import {
  ArrowOutIcon,
  ClockLeafIcon,
  ContactIcon,
  DocumentLeafIcon,
  FolderIcon,
  GroupIcon,
  HomeIcon,
  IdBadgeIcon,
  InvoiceIcon,
  NetworkIcon,
  PhoneLocationIcon,
  ReceiptIcon,
  UserIcon,
} from "@/components/side-nav-icons";

const ALL_ROLES_ITEMS = [
  { href: "/projects", label: "Projects", icon: FolderIcon },
  { href: "/contacts", label: "Contacts", icon: ContactIcon },
  { href: "/documents", label: "Documents", icon: DocumentLeafIcon },
  { href: "/time", label: "Time", icon: ClockLeafIcon },
];

const EMPLOYEE_ITEMS = [
  { href: "/", label: "Dashboard", icon: HomeIcon },
  { href: "/clients", label: "Clients", icon: GroupIcon },
];

const ADMIN_NAV_ITEMS = [
  { href: "/expenses", label: "Expenses", icon: ReceiptIcon },
  { href: "/payroll", label: "Payroll", icon: IdBadgeIcon },
  { href: "/reports", label: "Reports", icon: NetworkIcon },
  { href: "/invoices", label: "Invoices", icon: InvoiceIcon },
  { href: "/users", label: "Users", icon: GroupIcon },
  { href: "/admin/integrations", label: "Integrations", icon: NetworkIcon },
];

export function SideNav({
  open,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  function isActive(href: string) {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname.startsWith(href);
  }

  const initials = user.name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white text-gray-800 transition-transform dark:border-gray-800 dark:bg-gray-900 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center gap-3 border-b border-gray-200 py-2 px-6 dark:border-gray-800">
          <Logo className="h-14 w-14 shrink-0" />
          <span className="truncate font-bold tracking-tight text-lg text-(--color-sage-dark) dark:text-gray-100 leading-[1.2]">
            <p>Interface</p>
            <p>Environmental</p>
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {user.role !== "contractor" &&
            EMPLOYEE_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(item.href)}
                onClose={onClose}
              />
            ))}

          {ALL_ROLES_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              onClose={onClose}
            />
          ))}

          {user.role === "contractor" && (
            <NavLink
              item={{
                href: "/mobile",
                label: "Mobile View",
                icon: PhoneLocationIcon,
              }}
              active={isActive("/mobile")}
              onClose={onClose}
            />
          )}

          {user.isAdmin &&
            ADMIN_NAV_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(item.href)}
                onClose={onClose}
              />
            ))}
        </nav>

        <div className="space-y-1 border-t border-gray-200 p-3 dark:border-gray-800">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--color-dusk-pale) text-sm font-medium text-(--color-sage-dark) dark:bg-(--color-sage-dark) dark:text-(--color-dusk-light)">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                {user.name}
              </p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {user.email}
              </p>
            </div>
          </div>

          <NavLink
            item={{ href: "/profile", label: "Settings", icon: UserIcon }}
            active={pathname === "/profile"}
            onClose={onClose}
          />

          <button
            onClick={() => {
              logout();
              onClose?.();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <ArrowOutIcon className="h-5 w-5 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

/* ---------- Helpers ---------- */

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

function navLinkClass(active: boolean) {
  return `flex items-center gap-3 rounded-lg px-3 py-2 font-medium transition-colors ${
    active
      ? "bg-(--color-sage-light) text-(--color-dusk) dark:bg-(--color-sage-dark) dark:text-(--color-dusk-light)"
      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
  }`;
}

function NavLink({
  item,
  active,
  onClose,
}: {
  item: NavItem;
  active: boolean;
  onClose?: () => void;
}) {
  return (
    <Link href={item.href} onClick={onClose} className={navLinkClass(active)}>
      <item.icon className="h-6 w-6 shrink-0" />
      {item.label}
    </Link>
  );
}
