import type { Metadata } from "next";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { ManagementTable } from "../components/management-table";
import { deleteArmy, saveArmy } from "./actions";

export const metadata: Metadata = { title: "Armeen | Tabletop" };

export default async function ArmiesPage() {
  await connection();
  const [armies, users] = await Promise.all([
    prisma.army.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }] }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);
  return <ManagementTable title="Armeen" singular="Armee" rows={armies} detailPath="/armies"
    fields={[
      { name: "name", label: "Name" },
      { name: "ownerId", label: "Besitzer", type: "select", options: users.map((user) => ({ value: user.id, label: `${user.name} (${user.email})` })) },
    ]} saveAction={saveArmy} deleteAction={deleteArmy} />;
}
