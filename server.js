import express from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);
const app = express();
const PORT = process.env.PORT || 3000;
const SHARED_SECRET = process.env.SHARED_SECRET || '';

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-service-secret');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'YouTube Audio Extractor' });
});

// Auth: enforced only when SHARED_SECRET is set in Railway
function requireSecret(req, res, next) {
  if (!SHARED_SECRET) return next();
  if (req.get('x-service-secret') !== SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function validUrl(raw) {
  try {
    const u = new URL(raw);
    return ['http:', 'https:'].includes(u.protocol);
  } catch {
    return false;
  }
}

const BASE_ARGS = ['--js-runtimes', 'node', '--no-playlist', '--no-warnings'];

app.post('/extract', requireSecret, async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || !validUrl(url)) {
      return res.status(400).json({ error: 'A valid URL is required' });
    }
    console.log(`[Extract] Processing: ${url}`);

    const { stdout } = await execFileAsync(
      'yt-dlp',
      [...BASE_ARGS, '-f', 'bestaudio/best', '--get-url', url],
      { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }
    );

    const audioUrl = stdout.trim().split('\n')[0];
    if (!audioUrl) {
      return res.status(500).json({ error: 'Failed to extract audio URL' });
    }
    console.log('[Extract] ✅ Success');
    res.json({ audioUrl });
  } catch (error) {
    const details = (error.stderr || error.message || '').toString().slice(0, 800);
    console.error('[Extract] ❌ Error:', details);
    res.status(500).json({ error: 'Failed to extract audio', details });
  }
});

app.post('/download', requireSecret, async (req, res) => {
  let base = null;
  const cleanup = () => {
    if (!base) return;
    const f = `${base}.mp3`;
    fs.unlink(f, () => {});
  };

  try {
    const { url } = req.body || {};
    if (!url || !validUrl(url)) {
      return res.status(400).json({ error: 'A valid URL is required' });
    }
    console.log(`[Download] Processing: ${url}`);

    base = path.join(
      os.tmpdir(),
      `youtube_${Date.now()}_${Math.random().toString(36).substring(7)}`
    );

    await execFileAsync(
      'yt-dlp',
      [
        ...BASE_ARGS,
        '-f', 'bestaudio/best',
        '-x', '--audio-format', 'mp3',
        '-o', `${base}.%(ext)s`,
        url,
      ],
      { timeout: 180000, maxBuffer: 10 * 1024 * 1024 }
    );

    const mp3File = `${base}.mp3`;
    if (!fs.existsSync(mp3File)) throw new Error('Downloaded file not found');

    const fileSize = fs.statSync(mp3File).size;
    console.log(`[Download] ✅ Success (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="audio.mp3"');
    res.setHeader('Content-Length', fileSize);

    const stream = fs.createReadStream(mp3File);
    stream.pipe(res);
    res.on('close', cleanup);
    stream.on('error', (err) => {
      console.error('[Download] Stream error:', err);
      cleanup();
    });
  } catch (error) {
    const details = (error.stderr || error.message || '').toString().slice(0, 800);
    console.error('[Download] ❌ Error:', details);
    cleanup();
    res.status(500).json({ error: 'Failed to download audio', details });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ YouTube audio extraction service running on port ${PORT}`);
});
