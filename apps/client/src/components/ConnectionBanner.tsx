import { useEffect, useState } from "react";

export function ConnectionBanner({
  isOffline,
  opponentAway,
  graceExpiresAt,
}: {
  isOffline: boolean;
  opponentAway?: boolean;
  graceExpiresAt?: number | null;
}) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (!opponentAway || !graceExpiresAt) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => {
      const s = Math.max(0, Math.ceil((graceExpiresAt - Date.now()) / 1000));
      setSecondsLeft(s);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [opponentAway, graceExpiresAt]);

  if (isOffline) {
    return (
      <div className="mb-4 rounded-lg bg-red-600/80 text-white px-4 py-2 text-center font-medium">
        You’re offline — trying to reconnect…
      </div>
    );
  }

  if (opponentAway && secondsLeft > 0) {
    return (
      <div className="mb-4 rounded-lg bg-amber-500/90 text-black px-4 py-2 text-center font-semibold">
        Opponent disconnected. Awarding pot in {secondsLeft}s unless they return.
      </div>
    );
  }

  return null;
}
