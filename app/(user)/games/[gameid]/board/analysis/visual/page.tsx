import { loadRoundHistory } from "./history-data";
import { RoundHistoryViewer } from "./round-history-viewer";

export default async function VisualPage({ params, searchParams }: {
  params: Promise<{ gameid: string }>;
  searchParams: Promise<{ round?: string | string[]; from?: string | string[]; to?: string | string[] }>;
}) {
  const { gameid } = await params;
  const { round, from, to } = await searchParams;
  const end = typeof to === "string" ? to : typeof round === "string" ? round : undefined;
  const history = await loadRoundHistory(gameid, end, typeof from === "string" ? from : undefined);
  return <main lang="de" className="mx-auto w-full max-w-[1600px] px-4 py-3 sm:px-8">
    <h1 className="mb-3 text-sm font-semibold">{history.gameName} | {history.boardName} | Visuelle Analyse</h1>
    <RoundHistoryViewer history={history} />
  </main>;
}
