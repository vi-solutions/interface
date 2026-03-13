import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Interface Environmental",
  description: "Project & Operations Hub",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
