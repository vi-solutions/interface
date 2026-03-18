import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50",
  secondary:
    "border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800",
  ghost:
    "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50",
};

const base =
  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:cursor-not-allowed";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(function Button({ variant = "primary", className = "", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${className}`}
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
