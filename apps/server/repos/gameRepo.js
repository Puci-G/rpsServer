// apps/server/repos/gameRepo.js
import { prisma } from "../db.js";

/** Start a match: deduct fee from both + create Game + ledger (atomic) */
export async function startMatch(p1Id, p2Id, entryFee) {
  const fee = BigInt(entryFee);

  const result = await prisma.$transaction(async (tx) => {
    const [p1, p2] = await Promise.all([
      tx.player.findUnique({ where: { id: p1Id }, select: { balance: true } }),
      tx.player.findUnique({ where: { id: p2Id }, select: { balance: true } }),
    ]);
    if (!p1 || !p2) throw new Error("Player not found");
    if (p1.balance < fee) throw new Error("P1 insufficient balance");
    if (p2.balance < fee) throw new Error("P2 insufficient balance");

    const game = await tx.game.create({
      data: {
        status: "ACTIVE",
        player1Id: p1Id,
        player2Id: p2Id,
        rounds: 3,
        wager: fee * 2n,
      },
      select: { id: true },
    });

    const [u1, u2] = await Promise.all([
      tx.player.update({
        where: { id: p1Id },
        data: { balance: { decrement: fee } },
        select: { balance: true },
      }),
      tx.player.update({
        where: { id: p2Id },
        data: { balance: { decrement: fee } },
        select: { balance: true },
      }),
    ]);

    await Promise.all([
      tx.ledger.create({
        data: { playerId: p1Id, kind: "ADJUSTMENT", amount: -fee, ref: `game:${game.id}:entry` },
      }),
      tx.ledger.create({
        data: { playerId: p2Id, kind: "ADJUSTMENT", amount: -fee, ref: `game:${game.id}:entry` },
      }),
    ]);

    return { gameId: game.id, p1Bal: u1.balance, p2Bal: u2.balance };
  });

  return { gameId: result.gameId, p1Bal: Number(result.p1Bal), p2Bal: Number(result.p2Bal) };
}

/** Complete a match: pay pot to winner + mark COMPLETE + ledger (atomic) */
export async function completeMatch(gameId, winnerId, entryFee) {
  const pot = BigInt(entryFee) * 2n;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.game.update({
      where: { id: gameId },
      data: { status: "COMPLETE", winnerId },
    });

    const winner = await tx.player.update({
      where: { id: winnerId },
      data: { balance: { increment: pot } },
      select: { balance: true },
    });

    await tx.ledger.create({
      data: { playerId: winnerId, kind: "GAME_WIN", amount: pot, ref: `game:${gameId}:win` },
    });

    return { winnerBal: winner.balance };
  });

  return { winnerBal: Number(updated.winnerBal) };
}

/** Cancel a match (not used in the new 10s rule, but kept if needed) */
export async function cancelMatch(gameId, survivorId, entryFee) {
  const fee = BigInt(entryFee);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.game.update({ where: { id: gameId }, data: { status: "CANCELLED" } });
    const p = await tx.player.update({
      where: { id: survivorId },
      data: { balance: { increment: fee } },
      select: { balance: true },
    });
    await tx.ledger.create({
      data: { playerId: survivorId, kind: "ADJUSTMENT", amount: fee, ref: `game:${gameId}:cancel_refund` },
    });
    return { balance: p.balance };
  });

  return { balance: Number(updated.balance) };
}
