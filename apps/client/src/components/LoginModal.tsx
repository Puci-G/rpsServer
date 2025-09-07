import React, { useState } from 'react';

interface Props {
  login:    (name:string) => void;
  loginErr: string | null;
}

export const LoginModal: React.FC<Props> = ({ login, loginErr }) => {
  const [name, setName] = useState('');

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50">
      <div className="bg-neutral-800 p-6 rounded w-80 space-y-4">
        <h2 className="text-xl font-semibold text-white">Choose a name</h2>

        <input
          className="w-full p-2 rounded bg-neutral-700 text-white"
          value={name}
          maxLength={16}
          onChange={e=>setName(e.target.value)}
          onKeyDown={e=>e.key==='Enter' && login(name)}
        />

        {loginErr && <p className="text-red-400 text-sm">{loginErr}</p>}

        <button
          onClick={()=>login(name)}
          disabled={!name.trim()}
          className="w-full bg-purple-600 hover:bg-purple-700 py-2 rounded text-white disabled:opacity-50"
        >
          Play
        </button>
      </div>
    </div>
  );
};
