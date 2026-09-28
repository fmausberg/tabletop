import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata: Metadata = { title: "Spielfeld | Tabletop" };

export default async function BoardLayout({ children, params }: { children: ReactNode; params: Promise<{ gameid: string }> }) {
  const { gameid } = await params;
  const base = `/games/${gameid}/board`;
  return <>
    <nav aria-label="Spielansichten" className="mx-auto flex max-w-[1600px] flex-wrap gap-4 px-4 pt-4 text-sm sm:px-8">
      <Link href={base} className="underline">Aktuelle Phase</Link>
      <Link href={`${base}/analysis/details`} className="underline">Details</Link>
      <Link href={`${base}/analysis/visual`} className="underline">Visuelle Analyse</Link>
      <Link href={`${base}/analysis/stats`} className="underline">Statistiken</Link>
    </nav>
    {children}
  </>;
}
