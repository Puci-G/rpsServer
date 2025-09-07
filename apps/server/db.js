// apps/server/db.js
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;
export const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? [] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.__prisma = prisma;

// Normalize stored username (lowercase, trimmed)
export const normalize = (s) => s.trim().toLowerCase();

// Lookups / writes used by server.js
export async function getByName(nameKey) {
  const row = await prisma.player.findUnique({ where: { username: nameKey } });
  if (!row) return null;
  return { id: row.id, name: row.username, coins: Number(row.balance) };
}

export async function getById(id) {
  const row = await prisma.player.findUnique({ where: { id } });
  if (!row) return null;
  return { id: row.id, name: row.username, coins: Number(row.balance) };
}

// Simple depPath allocator (unique int)
async function allocateDepPath() {
  while (true) {
    const n = Math.floor(100000 + Math.random() * 900000);
    const exists = await prisma.player.findUnique({ where: { depPath: n } });
    if (!exists) return n;
  }
}

export async function insertPlayer({ id, name, coins }) {
  const depPath = await allocateDepPath();
  const created = await prisma.player.create({
    data: {
      id,
      username: name,
      depPath,
      balance: BigInt(coins),
    },
  });
  return { id: created.id, name: created.username, coins: Number(created.balance) };
}

export function setCoins(id, coins) {
  // fire-and-forget (server UX stays smooth)
  return prisma.player
    .update({ where: { id }, data: { balance: BigInt(coins) } })
    .catch((e) => console.error("setCoins failed:", e?.message || e));
}
