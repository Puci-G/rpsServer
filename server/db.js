// server/db.js  –  simplest possible JSON “database”
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LowSync, JSONFileSync } from 'lowdb';

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, 'players.json');

const adapter = new JSONFileSync(file);
const db = new LowSync(adapter);
db.read();

// bootstrap structure on first run
db.data ||= { players: [] };
db.write();

/* ---------------- helpers ---------------- */

/** get player row by lower-cased name */
export const getByName = (name) => {
  const key = name.trim().toLowerCase();
  return db.data.players.find(p => p.name === key);
};

/** insert new player */
export const insertPlayer = ({ id, name, coins }) => {
  db.data.players.push({ id, name: name.trim().toLowerCase(), coins });
  db.write();
};

/** update coins */
export const setCoins = (id, coins) => {
  const row = db.data.players.find(p => p.id === id);
  if (row) {
    row.coins = coins;
    db.write();
  }
};
