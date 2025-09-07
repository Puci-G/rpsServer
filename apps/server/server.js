import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

import { getByName, insertPlayer, setCoins, getById, normalize } from "./db.js";
import { startMatch, completeMatch } from "./repos/gameRepo.js";

dotenv.config();

/* ---------- config ---------- */
const ORIGIN               = process.env.CORS_ORIGIN || "http://localhost:5173";
const STARTING_COINS       = 20;
const ENTRY_FEE            = 5;
const ROUND_TIME           = 7000;    // ms
const ROUNDS_TO_WIN        = 3;
const MAX_ROUNDS           = 5;
const DISCONNECT_GRACE_MS  = 10_000;  // 10 seconds

/* ---------- express / socket ---------- */
const app    = express();
const server = createServer(app);
const io     = new Server(server, {
  cors: { origin: ORIGIN, methods: ["GET", "POST"] },
  perMessageDeflate: false,
});
console.log("♦ perMessageDeflate is", io.opts.perMessageDeflate);

app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.json());
app.set("json replacer", (_k, v) => (typeof v === "bigint" ? v.toString() : v));
app.get("/health", (_req, res) => res.send("ok"));

/* ---------- runtime state ---------- */
const players          = new Map(); // socket.id → Player
const matchmakingQueue = [];
const activeGames      = new Map(); // game.id → Game
const activeNames      = new Set(); // normalized names online
const disconnectTimers = new Map(); // playerId → Timeout

/* ---------- models ---------- */
class Player {
  constructor(socketId, name, id, coins) {
    this.socketId = socketId;
    this.name     = name;
    this.id       = id || uuidv4();
    this.coins    = coins ?? STARTING_COINS;
    this.inQueue  = false;
    this.gameId   = null;
  }
}

class Game {
  constructor(p1, p2) {
    this.id            = uuidv4();
    this.player1       = p1;
    this.player2       = p2;
    this.currentRound  = 1;
    this.player1Score  = 0;
    this.player2Score  = 0;
    this.roundChoices  = {};
    this.roundTimer    = null;
    this.roundDeadline = null; // ms timestamp
    this.pot           = ENTRY_FEE * 2;
  }

  startRound() {
    this.roundChoices = {};
    this.roundDeadline = Date.now() + ROUND_TIME;

    io.to(this.player1.socketId).emit("roundStart", {
      round: this.currentRound,
      player1Score: this.player1Score,
      player2Score: this.player2Score,
      timer: Math.ceil(ROUND_TIME / 1000),
    });

    io.to(this.player2.socketId).emit("roundStart", {
      round: this.currentRound,
      player1Score: this.player2Score,
      player2Score: this.player1Score,
      timer: Math.ceil(ROUND_TIME / 1000),
    });

    this.roundTimer = setTimeout(() => this.evaluateRound(), ROUND_TIME);
  }

  makeChoice(id, choice) {
    if (this.roundTimer === null) return false;
    this.roundChoices[id] = choice;
    const data = { playerId: id, hasChoice: true };
    io.to(this.player1.socketId).emit("choiceMade", data);
    io.to(this.player2.socketId).emit("choiceMade", data);
    return true;
  }

  evaluateRound() {
    clearTimeout(this.roundTimer);
    this.roundTimer = null;
    this.roundDeadline = null;

    const p1Choice = this.roundChoices[this.player1.id] ?? this.randomChoice();
    const p2Choice = this.roundChoices[this.player2.id] ?? this.randomChoice();
    const winner   = this.determineWinner(p1Choice, p2Choice);

    let p1Res = "tie", p2Res = "tie";
    if (winner === "player1") { this.player1Score++; p1Res = "win";  p2Res = "lose"; }
    if (winner === "player2") { this.player2Score++; p1Res = "lose"; p2Res = "win";  }

    io.to(this.player1.socketId).emit("roundResult", {
      yourChoice: p1Choice,
      opponentChoice: p2Choice,
      result: p1Res,
      player1Score: this.player1Score,
      player2Score: this.player2Score,
      round: this.currentRound,
    });
    io.to(this.player2.socketId).emit("roundResult", {
      yourChoice: p2Choice,
      opponentChoice: p1Choice,
      result: p2Res,
      player1Score: this.player2Score,
      player2Score: this.player1Score,
      round: this.currentRound,
    });

    if (this.player1Score >= ROUNDS_TO_WIN || this.player2Score >= ROUNDS_TO_WIN) {
      return setTimeout(() => this.endGame(), 3000);
    }
    this.currentRound++;
    setTimeout(() => this.startRound(), 3000);
  }

  determineWinner(a, b) {
    if (a === b) return "tie";
    const win = { rock: "scissors", paper: "rock", scissors: "paper" };
    return win[a] === b ? "player1" : "player2";
  }

  randomChoice() {
    return ["rock", "paper", "scissors"][Math.floor(Math.random() * 3)];
  }

  endGame() {
    const winner = this.player1Score > this.player2Score ? this.player1 : this.player2;
    (async () => {
      try {
        const res = await completeMatch(this.id, winner.id, ENTRY_FEE);
        winner.coins = res.winnerBal;
      } catch (e) {
        console.error("completeMatch failed:", e?.message || e);
      }

      const payload = (me, tag, myScore, oppScore) => ({
        winner: tag,
        finalScore: { player1: myScore, player2: oppScore },
        coinsWon: tag === "you" ? this.pot : 0,
        newBalance: me.coins,
      });

      io.to(this.player1.socketId).emit(
        "gameEnd",
        payload(
          this.player1,
          winner === this.player1 ? "you" : "opponent",
          this.player1Score,
          this.player2Score
        )
      );
      io.to(this.player2.socketId).emit(
        "gameEnd",
        payload(
          this.player2,
          winner === this.player2 ? "you" : "opponent",
          this.player2Score,
          this.player1Score
        )
      );

      this.player1.gameId = this.player2.gameId = null;
      activeGames.delete(this.id);
    })();
  }
}

/* ---------- helpers for disconnect/return ---------- */
function scheduleForfeitTimer(offender, game) {
  // Clear any prior timer for this player
  const existing = disconnectTimers.get(offender.id);
  if (existing) clearTimeout(existing);

  const survivor = game.player1.id === offender.id ? game.player2 : game.player1;
  const expiresAt = Date.now() + DISCONNECT_GRACE_MS;

  // Let the survivor know the opponent is away
  io.to(survivor.socketId).emit("opponentAway", {
    gameId: game.id,
    expiresAt,               // ms epoch
    seconds: DISCONNECT_GRACE_MS / 1000
  });

  const timer = setTimeout(async () => {
    // If the game ended or offender rejoined and cleared timer, stop.
    if (!activeGames.has(game.id)) return;

    // Kill any running round timer
    if (game.roundTimer) clearTimeout(game.roundTimer);

    // Pay the survivor the pot and end the match
    try {
      const res = await completeMatch(game.id, survivor.id, ENTRY_FEE);
      survivor.coins = res.winnerBal;
    } catch (e) {
      console.error("completeMatch (forfeit) failed:", e?.message || e);
    }

    io.to(survivor.socketId).emit("opponentForfeited", {
      gameId: game.id,
      coinsWon: game.pot,
      newBalance: survivor.coins,
    });

    survivor.gameId = null;
    activeGames.delete(game.id);
    disconnectTimers.delete(offender.id);
  }, DISCONNECT_GRACE_MS);

  disconnectTimers.set(offender.id, timer);
}

/* When a player returns, cancel any pending forfeit and notify the survivor. */
function cancelForfeitIfPending(returningPlayerId) {
  const t = disconnectTimers.get(returningPlayerId);
  if (t) {
    clearTimeout(t);
    disconnectTimers.delete(returningPlayerId);

    // If they’re in a game, notify the opponent that they're back.
    for (const [, g] of activeGames.entries()) {
      if (g.player1.id === returningPlayerId || g.player2.id === returningPlayerId) {
        const survivor = g.player1.id === returningPlayerId ? g.player2 : g.player1;
        io.to(survivor.socketId).emit("opponentBack", { gameId: g.id });
        break;
      }
    }
  }
}

/* Reattach a returning socket to an ongoing game, if any */
function reattachToGameIfAny(player) {
  for (const [, g] of activeGames.entries()) {
    if (g.player1.id === player.id) {
      g.player1 = player; // swap to the new socket
      player.gameId = g.id;

      // Tell the rejoiner which game they’re in
      io.to(player.socketId).emit("gameFound", {
        gameId: g.id,
        opponent: g.player2.name,
        newBalance: player.coins,
      });

      // If a round is in progress, send a fresh roundStart with remaining time
      if (g.roundTimer && g.roundDeadline) {
        const remaining = Math.max(0, Math.ceil((g.roundDeadline - Date.now()) / 1000));
        io.to(player.socketId).emit("roundStart", {
          round: g.currentRound,
          player1Score: g.player1Score,
          player2Score: g.player2Score,
          timer: remaining || 1,
        });
      }
      return true;
    }
    if (g.player2.id === player.id) {
      g.player2 = player;
      player.gameId = g.id;

      io.to(player.socketId).emit("gameFound", {
        gameId: g.id,
        opponent: g.player1.name,
        newBalance: player.coins,
      });

      if (g.roundTimer && g.roundDeadline) {
        const remaining = Math.max(0, Math.ceil((g.roundDeadline - Date.now()) / 1000));
        // Swap score order for player2's perspective
        io.to(player.socketId).emit("roundStart", {
          round: g.currentRound,
          player1Score: g.player2Score,
          player2Score: g.player1Score,
          timer: remaining || 1,
        });
      }
      return true;
    }
  }
  return false;
}

/* ---------- matchmaking ---------- */
async function tryMatchmaking() {
  while (matchmakingQueue.length >= 2) {
    const p1 = matchmakingQueue.shift();
    const p2 = matchmakingQueue.shift();
    p1.inQueue = p2.inQueue = false;

    let started;
    try {
      started = await startMatch(p1.id, p2.id, ENTRY_FEE);
    } catch (e) {
      console.error("startMatch failed:", e?.message || e);
      io.to(p1.socketId).emit("queueError", { message: "Match start failed" });
      io.to(p2.socketId).emit("queueError", { message: "Match start failed" });
      continue;
    }

    p1.coins = started.p1Bal;
    p2.coins = started.p2Bal;

    const game = new Game(p1, p2);
    game.id = started.gameId;
    activeGames.set(game.id, game);
    p1.gameId = p2.gameId = game.id;

    io.to(p1.socketId).emit("gameFound", {
      gameId: game.id,
      opponent: p2.name,
      newBalance: p1.coins,
    });
    io.to(p2.socketId).emit("gameFound", {
      gameId: game.id,
      opponent: p1.name,
      newBalance: p2.coins,
    });

    setTimeout(() => game.startRound(), 2000);
  }
}

/* ---------- socket events ---------- */
io.on("connection", (socket) => {
  console.log("🟢", socket.id);

  /* LOGIN */
  socket.on("login", async ({ name }) => {
    if (!name || typeof name !== "string" || !name.trim())
      return socket.emit("loginError", { message: "Name required" });

    const key = normalize(name);
    if (activeNames.has(key))
      return socket.emit("loginError", { message: "Name already taken" });

    const row = await getByName(key);
    const player = row
      ? new Player(socket.id, name.trim(), row.id, row.coins)
      : new Player(socket.id, name.trim());

    if (!row) await insertPlayer({ id: player.id, name: key, coins: player.coins });

    activeNames.add(key);
    players.set(socket.id, player);

    cancelForfeitIfPending(player.id);
    reattachToGameIfAny(player); // if they were mid-game, reconnect them

    socket.emit("playerInfo", { id: player.id, name: player.name, coins: player.coins });
  });

  /* RESUME */
  socket.on("resume", async ({ id }) => {
    if (!id) return socket.emit("loginError", { message: "Missing id" });

    const row = await getById(id);
    if (!row) return socket.emit("loginError", { message: "Unknown id, please login" });

    // Evict any old socket for this user
    for (const [sid, p] of players.entries()) {
      if (p.id === id && sid !== socket.id) {
        try { io.sockets.sockets.get(sid)?.disconnect(true); } catch {}
        players.delete(sid);
      }
    }

    const player = new Player(socket.id, row.name, row.id, row.coins);
    activeNames.add(normalize(row.name));
    players.set(socket.id, player);

    cancelForfeitIfPending(player.id);
    reattachToGameIfAny(player);

    socket.emit("playerInfo", { id: player.id, name: player.name, coins: player.coins });
  });

  /* LOGOUT */
  socket.on("logout", () => {
    const p = players.get(socket.id);
    if (!p) {
      socket.emit("loggedOut");
      try { socket.disconnect(true); } catch {}
      return;
    }

    activeNames.delete(normalize(p.name));

    // remove from queue
    if (p.inQueue) {
      const idx = matchmakingQueue.findIndex((x) => x.id === p.id);
      if (idx > -1) matchmakingQueue.splice(idx, 1);
      p.inQueue = false;
    }

    // start grace if they were in-game
    if (p.gameId) {
      const g = activeGames.get(p.gameId);
      if (g) scheduleForfeitTimer(p, g);
    }

    players.delete(socket.id);
    socket.emit("loggedOut");
    try { socket.disconnect(true); } catch {}
  });

  /* QUEUE */
  socket.on("joinQueue", () => {
    const p = players.get(socket.id);
    if (!p || p.inQueue || p.gameId) return;
    if (p.coins < ENTRY_FEE)
      return socket.emit("queueError", { message: "Not enough coins" });

    p.inQueue = true;
    matchmakingQueue.push(p);
    socket.emit("queueJoined", {
      position: matchmakingQueue.length,
      queueSize: matchmakingQueue.length,
    });
    tryMatchmaking();
  });

  socket.on("leaveQueue", () => {
    const p = players.get(socket.id);
    if (!p || !p.inQueue) return;

    p.inQueue = false;
    const idx = matchmakingQueue.findIndex((x) => x.id === p.id);
    if (idx > -1) matchmakingQueue.splice(idx, 1);
    socket.emit("queueLeft");
  });

  /* GAME */
  socket.on("makeChoice", ({ choice }) => {
    const p = players.get(socket.id);
    if (!p || !p.gameId) return;
    const g = activeGames.get(p.gameId);
    if (g) {
      g.makeChoice(p.id, choice);
      socket.emit("choiceConfirmed", { choice });
    }
  });

  /* DISCONNECT */
  socket.on("disconnect", () => {
    console.log("🔴", socket.id);
    const p = players.get(socket.id);
    if (!p) return;

    activeNames.delete(normalize(p.name));

    if (p.inQueue) {
      const idx = matchmakingQueue.findIndex((x) => x.id === p.id);
      if (idx > -1) matchmakingQueue.splice(idx, 1);
      p.inQueue = false;
    }

    if (p.gameId) {
      const g = activeGames.get(p.gameId);
      if (g) scheduleForfeitTimer(p, g);
    }

    players.delete(socket.id);
  });
});

/* ---------- start ---------- */
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀  RPS server @:${PORT}`));
