import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const checkScraperOutput = async () => {
    try {
        const response = await axios.get('http://localhost:8000/scrape/1499216', {
            headers: { 'x-sync-secret': process.env.ADMIN_TOKEN }
        });
        console.log('Scraper Output Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Scraper Call Failed:', error.response?.data || error.message);
    }
};

checkScraperOutput();
