"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/characters", label: "Characters" },
  { href: "/games", label: "Games" },
  { href: "/boards", label: "Boards" },
];

export function UserNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Verwaltung" className="mx-auto flex w-full max-w-[1600px] flex-wrap gap-4 px-4 pt-4 text-sm underline underline-offset-4 sm:px-8 sm:pt-8">
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined}
          className="aria-[current=page]:font-semibold"
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
