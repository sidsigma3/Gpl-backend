import { syncData } from './src/jobs/syncCricHeroes.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('--- STARTING GLOBAL DEEP SYNC ---');
console.log('This will fetch ALL matches and ALL scorecards and push them to Supabase.');
console.log('Since you are running this locally, it will bypass Render IP blocks.');

async function run() {
  try {
    await syncData();
    console.log('--- DEEP SYNC COMPLETE ---');
    process.exit(0);
  } catch (err) {
    console.error('Deep Sync Failed:', err);
    process.exit(1);
  }
}

run();
