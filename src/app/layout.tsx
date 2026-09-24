import type { Metadata } from "next";
import Link from "next/link";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import {
  THEME_COOKIE,
  THEME_SYSTEM_COOKIE,
  resolveInitialDark
} from "@/lib/theme";
import ThemeToggle from "@/components/ThemeToggle";
import ThemeProvider from "@/components/ThemeProvider";
import LogoutButton from "@/components/LogoutButton";
import "./globals.css";
import "@excalidraw/excalidraw/index.css";

export const metadata: Metadata = {
  title: "Design Rounds — Low Level Design like LeetCode",
  description:
    "Practice Low Level Design: object modeling, flow diagrams, and code with stage-wise SOLID + design-pattern feedback and a configurable timer.",
};

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"]
});

const code = JetBrains_Mono({
  variable: "--font-code",
  subsets: ["latin"]
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser().catch(() => null);
  // Pre-paint theme from cookies — no <script> tags (React won't run those).
  const jar = await cookies();
  const dark = resolveInitialDark(
    jar.get(THEME_COOKIE)?.value,
    jar.get(THEME_SYSTEM_COOKIE)?.value
  );
  return (
    <html
      lang="en"
      className={`${display.variable} ${code.variable} h-full antialiased${dark ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <ThemeProvider />
        <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
              <span aria-hidden className="inline-block h-4 w-4 rounded-[3px] border-2 border-current" />
              Design Rounds
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/problems" className="hover:text-indigo-600">
                Problems
              </Link>
              <Link href="/hld" className="hover:text-indigo-600">
                HLD
              </Link>
              <Link href="/learn" className="hover:text-indigo-600">
                Learn
              </Link>
              <Link href="/progress" className="hover:text-indigo-600">
                Progress
              </Link>
              <ThemeToggle />
              {user ? (
                <span className="flex items-center gap-2 text-sm">
                  <span
                    title={user.email}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white"
                  >
                    {user.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="max-w-28 truncate text-zinc-600 dark:text-zinc-300">
                    {user.name}
                  </span>
                  <LogoutButton />
                </span>
              ) : (
                <Link
                  href="/login"
                  className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Log in
                </Link>
              )}
              <Link
                href="/problems"
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700"
              >
                Start practicing
              </Link>
            </nav>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-zinc-200 bg-white py-4 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          An interview room for low-level design — clarify, model, draw, code. Plus animated HLD.
        </footer>
      </body>
    </html>
  );
}
