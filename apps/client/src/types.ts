export interface Player {
  id: string;
  name: string;
  coins: number;
}

export interface GameState {
  gameId: string | null;
  opponent: string | null;
  currentRound: number;
  player1Score: number;
  player2Score: number;
  timeRemaining: number;
  selectedChoice: string | null;
  gamePhase: 'waiting' | 'starting' | 'round' | 'results' | 'finished';
  lastRoundResult: RoundResult | null;

  // new (optional) flags for DC grace UI
  opponentAway?: boolean;
  graceExpiresAt?: number | null; // ms epoch
}

export interface RoundResult {
  yourChoice: string;
  opponentChoice: string;
  result: 'win' | 'lose' | 'tie';
}

export interface QueueState {
  inQueue: boolean;
  position: number;
  queueSize: number;
}

export type Choice = 'rock' | 'paper' | 'scissors';

export interface SocketEvents {
  // Client to Server
  joinQueue: () => void;
  leaveQueue: () => void;
  makeChoice: (data: { choice: Choice }) => void;
  restartAsGuest: () => void;
  login: (data: { name: string }) => void;
  resume: (data: { id: string }) => void;
  logout: () => void;

  // Server to Client
  playerInfo: (data: Player) => void;
  loginError: (data: { message: string }) => void;
  queueJoined: (data: { position: number; queueSize: number }) => void;
  queueLeft: () => void;
  gameFound: (data: { gameId: string; opponent: string; newBalance: number }) => void;
  roundStart: (data: { round: number; player1Score: number; player2Score: number; timer: number }) => void;
  choiceMade: (data: { playerId: string; hasChoice: boolean }) => void;
  choiceConfirmed: (data: { choice: Choice }) => void;
  roundResult: (data: { yourChoice: Choice; opponentChoice: Choice; result: 'win' | 'lose' | 'tie'; player1Score: number; player2Score: number; round: number }) => void;
  gameEnd: (data: { winner: 'you' | 'opponent' | 'tie'; finalScore: { player1: number; player2: number }; coinsWon: number; newBalance: number }) => void;

  opponentAway: (data: { gameId: string; expiresAt: number; seconds: number }) => void;
  opponentBack: (data: { gameId: string }) => void;
  opponentForfeited: (data: { gameId: string; coinsWon: number; newBalance: number }) => void;
  opponentDisconnected: (data: { newBalance: number }) => void;

  error: (data: { message: string }) => void;
  loggedOut: () => void;
}
