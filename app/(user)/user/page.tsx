import type { Metadata } from "next";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { ManagementTable } from "../components/management-table";
import { deleteUser, saveUser } from "./actions";

export const metadata: Metadata = { title: "User | Tabletop" };

export default async function UsersPage() {
  await connection();
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
  return <ManagementTable title="User" singular="Benutzer" rows={users}
    fields={[{ name: "name", label: "Name" }, { name: "email", label: "E-Mail", type: "email" }]}
    saveAction={saveUser} deleteAction={deleteUser} />;
}
