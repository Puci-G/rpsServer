import React from 'react';
import { Coins, User, Wifi, WifiOff } from 'lucide-react';
import { Player } from '../types';

interface HeaderProps {
  player: Player | null;
  connected: boolean;
}

export const Header: React.FC<HeaderProps> = ({ player, connected }) => {
  return (
    <header className="glass-strong p-6 mb-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
            <User className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white text-shadow">
              Rock Paper Scissors
            </h1>
            <div className="flex items-center space-x-2">
              {connected ? (
                <>
                  <Wifi className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 text-sm font-medium">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-red-400" />
                  <span className="text-red-400 text-sm font-medium">Connecting...</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        {player && (
          <div className="flex items-center space-x-3 glass p-4 rounded-xl">
            <Coins className="w-6 h-6 text-yellow-400" />
            <div className="text-right">
              <div className="text-2xl font-bold text-white">{player.coins}</div>
              <div className="text-yellow-200 text-sm">coins</div>
            </div>
          </div>
        )}
      </div>
      
      {player && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center space-x-2 glass p-3 rounded-lg">
            <span className="text-purple-200">Playing as</span>
            <span className="text-white font-bold">{player.name}</span>
          </div>
        </div>
      )}
    </header>
  );
};