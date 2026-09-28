import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaConstructor?: typeof PrismaClient;
};
// Hot reload must not reuse a client generated for an older database schema.

export const prisma = (globalForPrisma.prismaConstructor === PrismaClient ? globalForPrisma.prisma : undefined) ?? new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaConstructor = PrismaClient;
}
