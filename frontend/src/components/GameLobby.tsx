import React from 'react';
import { Play, Users, AlertCircle, Trophy, Clock, Coins } from 'lucide-react';
import { Player, QueueState } from '../types';

interface GameLobbyProps {
  player: Player | null;
  queueState: QueueState;
  onJoinQueue: () => void;
  onLeaveQueue: () => void;
  onRestartAsGuest: () => void;
}

export const GameLobby: React.FC<GameLobbyProps> = ({
  player,
  queueState,
  onJoinQueue,
  onLeaveQueue,
  onRestartAsGuest
}) => {
  const canPlay = player && player.coins >= 5;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Welcome Section */}
      <div className="glass-strong p-8 text-center animate-slide-up">
        <h2 className="text-4xl font-bold text-white mb-4 text-shadow">
          Ready to Battle?
        </h2>
        <p className="text-purple-200 text-lg">
          Challenge players worldwide in epic Rock Paper Scissors duels!
        </p>
      </div>

      {/* Game Rules */}
      <div className="glass p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <h3 className="text-2xl font-semibold text-white mb-4 flex items-center">
          <Trophy className="w-6 h-6 mr-2 text-yellow-400" />
          Game Rules
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-3 text-purple-200">
              <Coins className="w-5 h-5 text-yellow-400" />
              <span>Entry fee: <strong className="text-white">5 coins</strong></span>
            </div>
            <div className="flex items-center space-x-3 text-purple-200">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <span>Winner takes: <strong className="text-white">10 coins</strong></span>
            </div>
            <div className="flex items-center space-x-3 text-purple-200">
              <Users className="w-5 h-5 text-blue-400" />
              <span>Best of <strong className="text-white">5 rounds</strong></span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center space-x-3 text-purple-200">
              <Clock className="w-5 h-5 text-green-400" />
              <span><strong className="text-white">7 seconds</strong> per round</span>
            </div>
            <div className="flex items-center space-x-3 text-purple-200">
              <Play className="w-5 h-5 text-purple-400" />
              <span>First to <strong className="text-white">3 wins</strong></span>
            </div>
            <div className="flex items-center space-x-3 text-purple-200">
              <AlertCircle className="w-5 h-5 text-orange-400" />
              <span>Change choice anytime</span>
            </div>
          </div>
        </div>
      </div>

      {/* Insufficient Coins Warning */}
      {!canPlay && player && (
        <div className="glass p-6 border-red-500/30 bg-red-500/10 animate-scale-in">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-red-300 mb-2">
              Insufficient Coins
            </h3>
            <p className="text-red-200 mb-4">
              You need at least 5 coins to play. Start fresh with 20 coins!
            </p>
            <button
              onClick={onRestartAsGuest}
              className="btn-danger"
            >
              Restart as New Guest
            </button>
          </div>
        </div>
      )}

      {/* Queue Status or Play Button */}
      <div className="glass-strong p-8 text-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
        {!queueState.inQueue && canPlay && (
          <div className="space-y-4">
            <h3 className="text-2xl font-semibold text-white mb-6">
              Enter the Arena
            </h3>
            <button
              onClick={onJoinQueue}
              className="btn-primary text-xl py-4 px-12 shadow-2xl"
            >
              <Play className="w-6 h-6 mr-2 inline" />
              Play Now
            </button>
            <p className="text-purple-200 text-sm">
              You'll be matched with another player instantly
            </p>
          </div>
        )}

        {queueState.inQueue && (
          <div className="space-y-6">
            <div className="flex items-center justify-center space-x-3">
              <Users className="w-8 h-8 text-blue-400 animate-pulse" />
              <h3 className="text-2xl font-semibold text-white">
                Finding Opponent...
              </h3>
            </div>
            
            <div className="flex justify-center">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-400 border-t-transparent"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white font-bold">{queueState.position}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-purple-200">
                Position in queue: <strong className="text-white">#{queueState.position}</strong>
              </p>
              <p className="text-purple-200 text-sm">
                Players in queue: {queueState.queueSize}
              </p>
            </div>
            
            <button
              onClick={onLeaveQueue}
              className="btn-secondary"
            >
              Leave Queue
            </button>
          </div>
        )}
      </div>
    </div>
  );
};