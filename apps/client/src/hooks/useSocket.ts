import { useEffect, useState, useCallback } from "react";
import io, { Socket } from "socket.io-client";
import { Player, GameState, QueueState, Choice } from "../types";

type LoginError = { message: string };

const SERVER_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? "http://localhost:3001" : "");

const INITIAL_GAME: GameState = {
  gameId: null,
  opponent: null,
  currentRound: 1,
  player1Score: 0,
  player2Score: 0,
  timeRemaining: 7,
  selectedChoice: null,
  gamePhase: "waiting",
  lastRoundResult: null,
  opponentAway: false,
  graceExpiresAt: null,
};

const INITIAL_QUEUE: QueueState = {
  inQueue: false,
  position: 0,
  queueSize: 0,
};

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine); // <—
  const [player, setPlayer] = useState<Player | null>(null);
  const [loginErr, setLoginErr] = useState<string | null>(null);

  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME);
  const [queueState, setQueueState] = useState<QueueState>(INITIAL_QUEUE);

  // Keep a simple resume helper
  const resumeIfPossible = (s: Socket) => {
    const saved = localStorage.getItem("rpsPlayer");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.id) s.emit("resume", { id: parsed.id });
    }
  };

  useEffect(() => {
    const s = io(SERVER_URL, {
      transports: ["polling"],   // keep your current transport
      upgrade: false,
      secure: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 10000, // connect timeout
    });

    setSocket(s);

    const onConnect = () => {
      setConnected(true);
      resumeIfPossible(s);
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onConnectError = () => {
      // leave `connected` false; socket.io will retry automatically
    };

    // Browser network awareness
    const goOnline = () => {
      setIsOffline(false);
      if (!s.connected) s.connect();
    };
    const goOffline = () => setIsOffline(true);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("connect_error", onConnectError);

    s.on("playerInfo", (data: Player) => {
      setPlayer(data);
      localStorage.setItem("rpsPlayer", JSON.stringify({ id: data.id, name: data.name }));
    });

    s.on("loginError", (e: LoginError) => {
      setLoginErr(e.message);
      if (/unknown|missing|elsewhere/i.test(e.message)) {
        localStorage.removeItem("rpsPlayer");
      }
    });

    s.on("queueJoined", (data: { position: number; queueSize: number }) => {
      setGameState(INITIAL_GAME);
      setQueueState({ inQueue: true, position: data.position, queueSize: data.queueSize });
    });

    s.on("queueLeft", () => setQueueState(INITIAL_QUEUE));

    s.on("gameFound", (data: { gameId: string; opponent: string; newBalance: number }) => {
      setGameState((prev) => ({
        ...prev,
        gameId: data.gameId,
        opponent: data.opponent,
        gamePhase: "starting",
        currentRound: 1,
        player1Score: 0,
        player2Score: 0,
        selectedChoice: null,
        lastRoundResult: null,
        opponentAway: false,
        graceExpiresAt: null,
      }));
      setQueueState(INITIAL_QUEUE);
      setPlayer((prev) => (prev ? { ...prev, coins: data.newBalance } : null));
    });

    s.on("roundStart", (data: { round: number; player1Score: number; player2Score: number; timer: number }) => {
      setGameState((prev) => ({
        ...prev,
        currentRound: data.round,
        player1Score: data.player1Score,
        player2Score: data.player2Score,
        timeRemaining: data.timer,
        selectedChoice: null,
        gamePhase: "round",
        lastRoundResult: null,
        opponentAway: false,
        graceExpiresAt: null,
      }));
    });

    s.on("choiceConfirmed", (data: { choice: Choice }) => {
      setGameState((prev) => ({ ...prev, selectedChoice: data.choice }));
    });

    s.on("roundResult", (data: {
      player1Score: number;
      player2Score: number;
      yourChoice: Choice;
      opponentChoice: Choice;
      result: string;
    }) => {
      const valid = ["win", "lose", "tie"] as const;
      const result = valid.includes(data.result as "win" | "lose" | "tie")
        ? (data.result as "win" | "lose" | "tie")
        : "tie";
      setGameState((prev) => ({
        ...prev,
        player1Score: data.player1Score,
        player2Score: data.player2Score,
        gamePhase: "results",
        lastRoundResult: {
          yourChoice: data.yourChoice,
          opponentChoice: data.opponentChoice,
          result,
        },
      }));
    });

    s.on("gameEnd", (data: { winner: string; newBalance: number }) => {
      setGameState((prev) => ({ ...prev, gameId: null, opponent: null, gamePhase: "finished" }));
      setPlayer((prev) => (prev ? { ...prev, coins: data.newBalance } : null));
    });

    // NEW: grace-period UX
    s.on("opponentAway", (data: { gameId: string; expiresAt: number; seconds: number }) => {
      setGameState((prev) =>
        prev.gameId === data.gameId
          ? { ...prev, opponentAway: true, graceExpiresAt: data.expiresAt }
          : prev
      );
    });

    s.on("opponentBack", (data: { gameId: string }) => {
      setGameState((prev) =>
        prev.gameId === data.gameId
          ? { ...prev, opponentAway: false, graceExpiresAt: null }
          : prev
      );
    });

    s.on("opponentForfeited", (data: { gameId: string; coinsWon: number; newBalance: number }) => {
      setGameState((prev) =>
        prev.gameId === data.gameId
          ? { ...prev, gameId: null, opponent: null, gamePhase: "finished", opponentAway: false, graceExpiresAt: null }
          : prev
      );
      setPlayer((prev) => (prev ? { ...prev, coins: data.newBalance } : null));
    });

    // legacy path still supported by server
    s.on("opponentDisconnected", (data: { newBalance: number }) => {
      setGameState((prev) => ({ ...prev, gamePhase: "waiting", gameId: null, opponent: null }));
      setPlayer((prev) => (prev ? { ...prev, coins: data.newBalance } : null));
    });

    s.on("loggedOut", () => {
      localStorage.removeItem("rpsPlayer");
      setPlayer(null);
      setQueueState(INITIAL_QUEUE);
      setGameState(INITIAL_GAME);
    });

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      s.removeAllListeners();
      s.disconnect();
    };
  }, []);

  const login = useCallback((name: string) => {
    socket?.emit("login", { name });
  }, [socket]);

  const logout = useCallback(() => {
    socket?.emit("logout");
    localStorage.removeItem("rpsPlayer");
    setPlayer(null);
    setQueueState(INITIAL_QUEUE);
    setGameState(INITIAL_GAME);
    try { socket?.disconnect(); } catch {
      // ignore any disconnect errors
    }
  }, [socket]);

  const joinQueue = useCallback(() => {
    if (socket && player && player.coins >= 5) {
      socket.emit("joinQueue");
    }
  }, [socket, player]);

  const leaveQueue = useCallback(() => {
    socket?.emit("leaveQueue");
  }, [socket]);

  const makeChoice = useCallback((choice: Choice) => {
    if (socket && connected && gameState.gamePhase === "round") {
      socket.emit("makeChoice", { choice });
    }
  }, [socket, connected, gameState.gamePhase]);

  const restartAsGuest = useCallback(() => {
    if (socket) {
      socket.emit("restartAsGuest");
      setGameState(INITIAL_GAME);
    }
  }, [socket]);

  return {
    socket,
    login,
    logout,
    loginErr,
    connected,
    isOffline,    // <—
    player,
    gameState,
    queueState,
    joinQueue,
    leaveQueue,
    makeChoice,
    restartAsGuest,
  };
};
