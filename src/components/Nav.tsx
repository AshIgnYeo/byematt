"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/feed", label: "Feed", icon: "📰" },
  { href: "/capture", label: "Hunt", icon: "📸" },
  { href: "/reckoning", label: "Tally", icon: "🥃" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    // The bottom inset keeps the tabs clear of the home indicator once the app
    // is installed to the home screen.
    <nav className="sticky bottom-0 z-40 mt-auto grid grid-cols-3 border-t border-edge bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 py-3 text-xs font-semibold tracking-wide transition-colors ${
              active ? "text-flash" : "text-muted"
            }`}
          >
            <span aria-hidden className="text-lg">
              {tab.icon}
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
