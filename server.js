import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

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

// Extract YouTube audio URL (EXISTING - UNCHANGED)
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

// Download YouTube audio and return binary file (NEW)
app.post('/download', async (req, res) => {
  let tempFile = null;
  
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`[Download] Processing: ${url}`);

    // Create temporary file path
    const tempDir = os.tmpdir();
    const randomName = `youtube_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    tempFile = path.join(tempDir, randomName);

    console.log(`[Download] Downloading audio with yt-dlp...`);

    // Download with yt-dlp and convert to mp3
    await execAsync(
      `yt-dlp -f "bestaudio" -x --audio-format mp3 -o "${tempFile}.%(ext)s" "${url}"`,
      { timeout: 120000 } // 2 minute timeout for download
    );

    // The output file will be tempFile.mp3
    const mp3File = `${tempFile}.mp3`;
    
    if (!fs.existsSync(mp3File)) {
      throw new Error('Downloaded file not found');
    }

    const fileSize = fs.statSync(mp3File).size;
    console.log(`[Download] ✅ Success (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

    // Send file as binary
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="audio.mp3"');
    res.setHeader('Content-Length', fileSize);
    
    const fileStream = fs.createReadStream(mp3File);
    
    fileStream.pipe(res);
    
    // Clean up after sending
    fileStream.on('end', () => {
      fs.unlink(mp3File, (err) => {
        if (err) console.error('[Download] Cleanup error:', err);
        else console.log('[Download] Temp file cleaned up');
      });
    });

    fileStream.on('error', (err) => {
      console.error('[Download] Stream error:', err);
      if (fs.existsSync(mp3File)) {
        fs.unlinkSync(mp3File);
      }
    });

  } catch (error) {
    console.error('[Download] ❌ Error:', error.message);
    
    // Clean up on error
    if (tempFile) {
      const mp3File = `${tempFile}.mp3`;
      if (fs.existsSync(mp3File)) {
        fs.unlinkSync(mp3File);
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to download audio',
      details: error.message 
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ YouTube audio extraction service running on port ${PORT}`);
});
