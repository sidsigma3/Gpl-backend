import { syncData } from './src/jobs/syncCricHeroes.js';
import dotenv from 'dotenv';
dotenv.config();

const runTestSync = async () => {
    console.log('--- Manual Sync Test Start ---');
    try {
        await syncData();
        console.log('--- Manual Sync Test End ---');
    } catch (error) {
        console.error('Test Sync Failed:', error);
    }
    process.exit();
};

runTestSync();
