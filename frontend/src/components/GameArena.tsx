import React, { useEffect, useState } from 'react';
import { Timer, Trophy, Users, Crown, Zap, Play } from 'lucide-react';
import { GameState, Choice } from '../types';
import { ChoiceButton } from './ChoiceButton';

interface GameArenaProps {
  gameState: GameState;
  onMakeChoice: (choice: Choice) => void;
  onPlayAgain: () => void;
}

export const GameArena: React.FC<GameArenaProps> = ({
  gameState,
  onMakeChoice,
  onPlayAgain
}) => {
  const [countdown, setCountdown] = useState(gameState.timeRemaining);

  useEffect(() => {
    if (gameState.gamePhase === 'round') {
      setCountdown(gameState.timeRemaining);
      const timer = setInterval(() => {
        setCountdown(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameState.gamePhase, gameState.timeRemaining]);

  const getResultMessage = () => {
    if (!gameState.lastRoundResult) return '';
    
    if (gameState.gamePhase === 'finished') {
      if (gameState.player1Score > gameState.player2Score) {
        return 'Victory! You Win the Match! 🎉';
      } else {
        return 'Defeat! You Lose the Match 😔';
      }
    }
    
    switch (gameState.lastRoundResult.result) {
      case 'win':
        return 'Round Victory! 🎉';
      case 'lose':
        return 'Round Lost 😔';
      case 'tie':
        return 'Round Tied! 🤝';
      default:
        return '';
    }
  };

  const getChoiceEmoji = (choice: string) => {
    switch (choice) {
      case 'rock': return '🪨';
      case 'paper': return '📄';
      case 'scissors': return '✂️';
      default: return '❓';
    }
  };

  const getChoiceColor = (choice: string) => {
    switch (choice) {
      case 'rock': return 'from-gray-500 to-gray-700';
      case 'paper': return 'from-blue-500 to-blue-700';
      case 'scissors': return 'from-red-500 to-red-700';
      default: return 'from-gray-500 to-gray-700';
    }
  };

  if (gameState.gamePhase === 'starting') {
    return (
      <div className="glass-strong p-8 text-center max-w-2xl mx-auto animate-scale-in">
        <div className="space-y-6">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <Users className="w-10 h-10 text-green-400" />
            <h2 className="text-3xl font-bold text-white text-shadow">
              Match Found!
            </h2>
          </div>
          
          <div className="glass p-6 rounded-xl">
            <p className="text-purple-200 text-lg mb-2">You're facing</p>
            <p className="text-3xl font-bold text-white text-shadow">
              {gameState.opponent}
            </p>
          </div>
          
          <div className="space-y-2">
            <p className="text-purple-200">Preparing battle arena...</p>
            <div className="w-full bg-purple-900/30 rounded-full h-2">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Score Display */}
      <div className="glass-strong p-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="text-center">
            <p className="text-purple-200 text-sm mb-1">You</p>
            <div className="flex items-center justify-center space-x-2">
              <div className="text-4xl font-bold text-white">{gameState.player1Score}</div>
              {gameState.player1Score >= 3 && <Crown className="w-6 h-6 text-yellow-400" />}
            </div>
          </div>
          
          <div className="text-center px-8">
            <p className="text-purple-200 text-sm">Round {gameState.currentRound}/5</p>
            <div className="text-2xl font-bold text-white my-2">VS</div>
            <p className="text-purple-200 text-sm">{gameState.opponent}</p>
          </div>
          
          <div className="text-center">
            <p className="text-purple-200 text-sm mb-1">Opponent</p>
            <div className="flex items-center justify-center space-x-2">
              <div className="text-4xl font-bold text-white">{gameState.player2Score}</div>
              {gameState.player2Score >= 3 && <Crown className="w-6 h-6 text-yellow-400" />}
            </div>
          </div>
        </div>
      </div>

      {/* Timer */}
      {gameState.gamePhase === 'round' && (
        <div className="glass p-6 text-center animate-slide-up">
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Timer className="w-6 h-6 text-orange-400" />
              <span className="text-white font-semibold text-lg">Time Remaining</span>
            </div>
            
            <div className={`text-7xl font-bold transition-all duration-300 ${
              countdown <= 3 ? 'text-red-400 animate-pulse scale-110' : 'text-white'
            }`}>
              {countdown}
            </div>
            
            <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
              <div 
                className={`h-3 rounded-full transition-all duration-1000 ${
                  countdown <= 3 ? 'bg-gradient-to-r from-red-400 to-red-600' : 'bg-gradient-to-r from-green-400 to-blue-500'
                }`}
                style={{ width: `${(countdown / 7) * 100}%` }}
              ></div>
            </div>
            
            {gameState.selectedChoice && (
              <div className="flex items-center justify-center space-x-2 text-green-400">
                <Zap className="w-5 h-5" />
                <span className="font-semibold">Choice locked in!</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Choice Selection */}
      {gameState.gamePhase === 'round' && (
        <div className="glass p-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h3 className="text-2xl font-bold text-white text-center mb-8 text-shadow">
            Make Your Choice
          </h3>
          <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
            <ChoiceButton
              choice="rock"
              emoji="🪨"
              label="Rock"
              selected={gameState.selectedChoice === 'rock'}
              disabled={countdown === 0}
              onClick={() => onMakeChoice('rock')}
            />
            <ChoiceButton
              choice="paper"
              emoji="📄"
              label="Paper"
              selected={gameState.selectedChoice === 'paper'}
              disabled={countdown === 0}
              onClick={() => onMakeChoice('paper')}
            />
            <ChoiceButton
              choice="scissors"
              emoji="✂️"
              label="Scissors"
              selected={gameState.selectedChoice === 'scissors'}
              disabled={countdown === 0}
              onClick={() => onMakeChoice('scissors')}
            />
          </div>
        </div>
      )}

      {/* Round Results */}
      {gameState.gamePhase === 'results' && gameState.lastRoundResult && (
        <div className="glass-strong p-8 text-center animate-scale-in">
          <h3 className="text-3xl font-bold text-white mb-6 text-shadow">
            {getResultMessage()}
          </h3>
          
          <div className="flex items-center justify-center space-x-12 mb-8">
            <div className="text-center">
              <p className="text-purple-200 text-sm mb-3">You chose</p>
              <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${getChoiceColor(gameState.lastRoundResult.yourChoice)} flex items-center justify-center mb-3 shadow-xl`}>
                <div className="text-5xl">{getChoiceEmoji(gameState.lastRoundResult.yourChoice)}</div>
              </div>
              <p className="text-white font-bold capitalize text-lg">
                {gameState.lastRoundResult.yourChoice}
              </p>
            </div>
            
            <div className="text-5xl text-white animate-pulse">⚔️</div>
            
            <div className="text-center">
              <p className="text-purple-200 text-sm mb-3">Opponent chose</p>
              <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${getChoiceColor(gameState.lastRoundResult.opponentChoice)} flex items-center justify-center mb-3 shadow-xl`}>
                <div className="text-5xl">{getChoiceEmoji(gameState.lastRoundResult.opponentChoice)}</div>
              </div>
              <p className="text-white font-bold capitalize text-lg">
                {gameState.lastRoundResult.opponentChoice}
              </p>
            </div>
          </div>
          
          <div className="text-lg text-purple-200">
            {gameState.player1Score < 3 && gameState.player2Score < 3 && (
              <p>Next round starting soon...</p>
            )}
          </div>
        </div>
      )}

      {/* Game End */}
      {gameState.gamePhase === 'finished' && (
        <div className="glass-strong p-8 text-center animate-scale-in">
          <div className="space-y-6">
            <div className="mb-6">
              <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-4xl font-bold text-white mb-4 text-shadow">
                {getResultMessage()}
              </h3>
              <div className="glass p-4 rounded-xl inline-block">
                <p className="text-purple-200 text-lg">
                  Final Score: <span className="text-white font-bold text-xl">
                    {gameState.player1Score} - {gameState.player2Score}
                  </span>
                </p>
              </div>
            </div>
            
            <button
              onClick={onPlayAgain}
              className="btn-primary text-xl py-4 px-12 shadow-2xl"
            >
              <Play className="w-6 h-6 mr-2 inline" />
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};