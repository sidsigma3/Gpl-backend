import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const testScraper = async () => {
  try {
    const response = await axios.get('http://localhost:8000/health');
    console.log('Scraper Health:', response.data);
    
    // Test a basic scrape
    const scrape = await axios.get('http://localhost:8000/scrape/1499216', {
        headers: { 'x-sync-secret': 'gpl_sync_secret_2026' }
    });
    console.log('Scrape Success:', scrape.data);
  } catch (error) {
    console.error('Scraper Test Failed:', error.response?.data || error.message);
  }
};

testScraper();
