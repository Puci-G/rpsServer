import { useEffect, useState, useCallback } from "react";
import io, { Socket } from "socket.io-client";
import { Player, GameState, QueueState, Choice } from "../types";
type LoginError = { message: string };

const SERVER_URL = import.meta.env.VITE_API_URL;

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loginErr, setLoginErr] = useState<string | null>(null);

  const [gameState, setGameState] = useState<GameState>({
    gameId: null,
    opponent: null,
    currentRound: 1,
    player1Score: 0,
    player2Score: 0,
    timeRemaining: 7,
    selectedChoice: null,
    gamePhase: "waiting",
    lastRoundResult: null,
  });
  const [queueState, setQueueState] = useState<QueueState>({
    inQueue: false,
    position: 0,
    queueSize: 0,
  });

  useEffect(() => {
    const newSocket = io(SERVER_URL, {
      transports: ["websocket"],
      upgrade: false,
      secure: true,
    });

    setSocket(newSocket);

    newSocket.on("connect", () => {
      setConnected(true);
      console.log("🔗 Connected to server");
    });

    newSocket.on("disconnect", () => {
      setConnected(false);
      console.log("❌ Disconnected from server");
    });

    newSocket.on("loginError", (e: LoginError) => setLoginErr(e.message));

    newSocket.on("playerInfo", (data: Player) => {
      setPlayer(data);
      console.log("👤 Player info received:", data);
    });

    newSocket.on(
      "queueJoined",
      (data: { position: number; queueSize: number }) => {
        setGameState({
          gameId: null,
          opponent: null,
          currentRound: 1,
          player1Score: 0,
          player2Score: 0,
          timeRemaining: 7,
          selectedChoice: null,
          gamePhase: "waiting",
          lastRoundResult: null,
        });
        setQueueState({
          inQueue: true,
          position: data.position,
          queueSize: data.queueSize,
        });
        console.log("🎯 Joined queue at position:", data.position);
      }
    );

    newSocket.on("queueLeft", () => {
      setQueueState({
        inQueue: false,
        position: 0,
        queueSize: 0,
      });
      console.log("🚪 Left queue");
    });

    newSocket.on(
      "gameFound",
      (data: { gameId: string; opponent: string; newBalance: number }) => {
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
        }));

        setQueueState({
          inQueue: false,
          position: 0,
          queueSize: 0,
        });

        setPlayer((prev) =>
          prev ? { ...prev, coins: data.newBalance } : null
        );
        console.log("🎮 Game found! Opponent:", data.opponent);
      }
    );

    newSocket.on(
      "roundStart",
      (data: {
        round: number;
        player1Score: number;
        player2Score: number;
        timer: number;
      }) => {
        setGameState((prev) => ({
          ...prev,
          currentRound: data.round,
          player1Score: data.player1Score,
          player2Score: data.player2Score,
          timeRemaining: data.timer,
          selectedChoice: null,
          gamePhase: "round",
          lastRoundResult: null,
        }));
        console.log("⏰ Round started:", data.round);
      }
    );

    newSocket.on("choiceConfirmed", (data: { choice: Choice }) => {
      setGameState((prev) => ({
        ...prev,
        selectedChoice: data.choice,
      }));
    });

    type RoundResultData = {
      player1Score: number;
      player2Score: number;
      yourChoice: Choice;
      opponentChoice: Choice;
      result: string;
    };

    newSocket.on("roundResult", (data: RoundResultData) => {
      const validResults = ["win", "lose", "tie"] as const;
      const result = validResults.includes(
        data.result as "win" | "lose" | "tie"
      )
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
      console.log("📊 Round result:", data.result);
    });

    newSocket.on("gameEnd", (data: { winner: string; newBalance: number }) => {
      setGameState((prev) => ({
        ...prev,
        gameId: null,
        opponent: null,
        gamePhase: "finished",
      }));

      setPlayer((prev) => (prev ? { ...prev, coins: data.newBalance } : null));
      console.log("🏆 Game ended. Winner:", data.winner);
    });

    newSocket.on("opponentDisconnected", (data: { newBalance: number }) => {
      setGameState((prev) => ({
        ...prev,
        gamePhase: "waiting",
        gameId: null,
        opponent: null,
      }));

      setPlayer((prev) => (prev ? { ...prev, coins: data.newBalance } : null));
      console.log("👻 Opponent disconnected");
    });

    newSocket.on("error", (data: { message: string }) => {
      console.error("❌ Server error:", data.message);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const login = useCallback(
    (name: string) => {
      socket?.emit("login", { name });
    },
    [socket]
  );

  const joinQueue = useCallback(() => {
    if (socket && player && player.coins >= 5) {
      socket.emit("joinQueue");
    }
  }, [socket, player]);

  const leaveQueue = useCallback(() => {
    if (socket) {
      socket.emit("leaveQueue");
    }
  }, [socket]);

  const makeChoice = useCallback(
    (choice: Choice) => {
      if (socket && gameState.gamePhase === "round") {
        socket.emit("makeChoice", { choice });
      }
    },
    [socket, gameState.gamePhase]
  );

  const restartAsGuest = useCallback(() => {
    if (socket) {
      socket.emit("restartAsGuest");
      setGameState({
        gameId: null,
        opponent: null,
        currentRound: 1,
        player1Score: 0,
        player2Score: 0,
        timeRemaining: 7,
        selectedChoice: null,
        gamePhase: "waiting",
        lastRoundResult: null,
      });
    }
  }, [socket]);

  return {
    socket,
    login,
    loginErr,
    connected,
    player,
    gameState,
    queueState,
    joinQueue,
    leaveQueue,
    makeChoice,
    restartAsGuest,
  };
};
