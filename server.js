import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for your Supabase function
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'YouTube Audio Extractor' });
});

// Extract YouTube audio URL
app.post('/extract', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`[Extract] Processing: ${url}`);

    // Use yt-dlp to get the best audio stream URL
    const { stdout, stderr } = await execAsync(
      `yt-dlp -f bestaudio --get-url "${url}"`,
      { timeout: 30000 } // 30 second timeout
    );

    const audioUrl = stdout.trim();
    
    if (!audioUrl) {
      console.error('[Extract] No audio URL returned');
      return res.status(500).json({ error: 'Failed to extract audio URL' });
    }

    console.log(`[Extract] ✅ Success`);
    res.json({ audioUrl });
  } catch (error) {
    console.error('[Extract] ❌ Error:', error.message);
    res.status(500).json({ 
      error: 'Failed to extract audio',
      details: error.message 
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ YouTube audio extraction service running on port ${PORT}`);
});
