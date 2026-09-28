import { redirect } from "next/navigation";
import { loadBoardData } from "../board-data";

export default async function Page({ params }: { params: Promise<{ gameid: string }> }) {
  const { gameid } = await params;
  const snapshot = await loadBoardData(gameid, "COMBAT");
  redirect(`/games/${gameid}/board/combat/${snapshot.combatData?.assignmentsLocked ? "execute" : "assign"}`);
}
