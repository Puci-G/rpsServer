/* ------------------------------------------------------------
   Rock-Paper-Scissors • Named login + Lowdb persistence
   Choices can change until ROUND_TIME elapses
   ------------------------------------------------------------ */
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { getByName, insertPlayer, setCoins } from './db.js';

const ORIGIN         = 'http://localhost:5173';
const STARTING_COINS = 20;
const ENTRY_FEE      = 5;
const ROUND_TIME     = 7000;  // ms
const ROUNDS_TO_WIN  = 3;
const MAX_ROUNDS     = 5;

/* ---------- express / socket ---------- */
const app    = express();
const server = createServer(app);
const io     = new Server(server, { cors: { origin: ORIGIN, methods: ['GET','POST'] } });

app.use(cors({ origin: ORIGIN }));
app.use(express.json());

/* ---------- runtime state ---------- */
const players          = new Map();   // socket.id → Player
const matchmakingQueue = [];
const activeGames      = new Map();   // game.id   → Game
const activeNames      = new Set();   // names online

const normalise = s => s.trim().toLowerCase();

/* ---------- models ---------- */
class Player {
  constructor(socketId, name, id, coins) {
    this.socketId = socketId;
    this.name     = name;
    this.id       = id     || uuidv4();
    this.coins    = coins  ?? STARTING_COINS;
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
    this.pot           = ENTRY_FEE * 2;
  }

  /* --- round flow --- */
  startRound() {
    this.roundChoices = {};
    const payload = {
      round:         this.currentRound,
      player1Score:  this.player1Score,
      player2Score:  this.player2Score,
      timer:         ROUND_TIME / 1000
    };
    io.to(this.player1.socketId).emit('roundStart', payload);
    io.to(this.player2.socketId).emit('roundStart', payload);
    this.roundTimer = setTimeout(() => this.evaluateRound(), ROUND_TIME);
  }

  makeChoice(id, choice) {
    if (this.roundTimer === null) return false;
    this.roundChoices[id] = choice;               // overwrite ← last wins
    const data = { playerId: id, hasChoice: true };
    io.to(this.player1.socketId).emit('choiceMade', data);
    io.to(this.player2.socketId).emit('choiceMade', data);
    return true;
  }

  evaluateRound() {
    clearTimeout(this.roundTimer);
    this.roundTimer = null;

    const p1Choice = this.roundChoices[this.player1.id] ?? this.randomChoice();
    const p2Choice = this.roundChoices[this.player2.id] ?? this.randomChoice();
    const winner   = this.determineWinner(p1Choice, p2Choice);

    let p1Res='tie', p2Res='tie';
    if (winner === 'player1') { this.player1Score++; p1Res='win';  p2Res='lose'; }
    if (winner === 'player2') { this.player2Score++; p1Res='lose'; p2Res='win';  }

    /* ------------  FIXED: swap score order per socket  ------------ */
    io.to(this.player1.socketId).emit('roundResult', {
      yourChoice:     p1Choice,
      opponentChoice: p2Choice,
      result:         p1Res,
      player1Score:   this.player1Score,          // “you” for socket-1
      player2Score:   this.player2Score,
      round:          this.currentRound
    });
    io.to(this.player2.socketId).emit('roundResult', {
      yourChoice:     p2Choice,
      opponentChoice: p1Choice,
      result:         p2Res,
      player1Score:   this.player2Score,          // swapped for socket-2
      player2Score:   this.player1Score,
      round:          this.currentRound
    });
    /* -------------------------------------------------------------- */

    if (this.player1Score >= ROUNDS_TO_WIN ||
        this.player2Score >= ROUNDS_TO_WIN ||
        this.currentRound >= MAX_ROUNDS) {
      return setTimeout(() => this.endGame(), 3000);
    }
    this.currentRound++;
    setTimeout(() => this.startRound(), 3000);
  }

  determineWinner(a,b){
    if (a===b) return 'tie';
    const win = { rock:'scissors', paper:'rock', scissors:'paper' };
    return win[a] === b ? 'player1' : 'player2';
  }
  randomChoice(){ return ['rock','paper','scissors'][Math.floor(Math.random()*3)]; }

  endGame() {
    const winner = this.player1Score > this.player2Score ? this.player1 : this.player2;
    winner.coins += this.pot;
    setCoins(winner.id, winner.coins);

    const payload = (me, tag, myScore, oppScore) => ({
      winner: tag,
      finalScore: { player1: myScore, player2: oppScore },
      coinsWon: tag === 'you' ? this.pot : 0,
      newBalance: me.coins
    });

    /* ------------  FIXED: swapped scores here as well  ------------ */
    io.to(this.player1.socketId).emit('gameEnd',
      payload(this.player1,
              winner===this.player1 ? 'you' : 'opponent',
              this.player1Score, this.player2Score));

    io.to(this.player2.socketId).emit('gameEnd',
      payload(this.player2,
              winner===this.player2 ? 'you' : 'opponent',
              this.player2Score, this.player1Score));
    /* -------------------------------------------------------------- */

    this.player1.gameId = this.player2.gameId = null;
    activeGames.delete(this.id);
  }
}

/* ---------- matchmaking, socket events, start server ---------- */
/* (IDENTICAL to your current file – omitted for brevity) */

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀  RPS server @:${PORT}`));
