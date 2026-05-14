import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-sage text-white hover:bg-sage-dark disabled:opacity-50",
  secondary:
    "border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800",
  ghost:
    "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50",
  icon: "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1",
};

const base =
  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:cursor-not-allowed";

const iconBase =
  "inline-flex items-center justify-center rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:cursor-not-allowed";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(function Button({ variant = "primary", className = "", ...props }, ref) {
  const b = variant === "icon" ? iconBase : base;
  return (
    <button
      ref={ref}
      className={`${b} ${variants[variant]} ${className}`}
      {...props}
    />
  );
});

interface LinkButtonProps {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}

export function LinkButton({
  href,
  variant = "primary",
  className = "",
  children,
}: LinkButtonProps) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}
