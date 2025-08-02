import React from 'react';

interface ChoiceButtonProps {
  choice: string;
  emoji: string;
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export const ChoiceButton: React.FC<ChoiceButtonProps> = ({
  emoji,
  label,
  selected,
  disabled = false,
  onClick
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`choice-button ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''} 
        flex flex-col items-center justify-center space-y-3 h-32 relative overflow-hidden group`}
    >
      {selected && (
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-600/20 animate-pulse"></div>
      )}
      
      <div className={`text-5xl transition-transform duration-200 ${
        selected ? 'scale-110' : 'group-hover:scale-105'
      }`}>
        {emoji}
      </div>
      
      <span className={`text-sm font-bold transition-colors duration-200 ${
        selected ? 'text-white' : 'text-purple-200 group-hover:text-white'
      }`}>
        {label}
      </span>
      
      {selected && (
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        </div>
      )}
    </button>
  );
};