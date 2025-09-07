import { Header } from "./components/Header";
import { GameLobby } from "./components/GameLobby";
import { GameArena } from "./components/GameArena";
import { useSocket } from "./hooks/useSocket";
import { LoginModal } from "./components/LoginModal";
import { ConnectionBanner } from "./components/ConnectionBanner";

function App() {
  const {
    connected,
    player,
    login,
    logout,
    loginErr,
    gameState,
    queueState,
    joinQueue,
    leaveQueue,
    makeChoice,
    restartAsGuest,
  } = useSocket();

  const handlePlayAgain = () => {
    if (player && player.coins >= 5) {
      joinQueue();
    }
  };

  const isInGame =
    !!gameState.gameId &&
    ["starting", "round", "results", "finished"].includes(gameState.gamePhase);

  return (
    <div className="min-h-screen p-4">
      {!player && <LoginModal login={login} loginErr={loginErr} />}

      <div className="max-w-7xl mx-auto">
        <Header player={player} connected={connected} onLogout={logout} />
        <ConnectionBanner
          isOffline={!connected}
          opponentAway={gameState.opponentAway}
          graceExpiresAt={gameState.graceExpiresAt}
        />
        <main className="space-y-6">
          {!isInGame && (
            <GameLobby
              player={player}
              queueState={queueState}
              onJoinQueue={joinQueue}
              onLeaveQueue={leaveQueue}
              onRestartAsGuest={restartAsGuest}
            />
          )}

          {isInGame && (
            <GameArena
              gameState={gameState}
              onMakeChoice={makeChoice}
              onPlayAgain={handlePlayAgain}
            />
          )}
        </main>

        <footer className="mt-12 text-center">
          <p className="text-purple-300 text-sm">
            Real-time multiplayer Rock Paper Scissors • Built with React &
            Socket.io
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
