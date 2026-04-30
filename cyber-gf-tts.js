const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { getConfig } = require('./cyber-gf-config');

function getTtsConfig() {
  const config = getConfig();
  return {
    ...config.tts,
    outputDir: config.ttsOutputDir
  };
}

function buildTtsRequest(textContent, styleHint) {
  const CONFIG = getTtsConfig();
  const messages = [];
  if (styleHint && styleHint.trim()) {
    messages.push({ role: 'user', content: styleHint.trim() });
  }
  messages.push({ role: 'assistant', content: textContent });
  return {
    model: CONFIG.model,
    messages,
    audio: {
      format: CONFIG.format,
      voice: CONFIG.voice
    }
  };
}

function ensureOutputDir() {
  const CONFIG = getTtsConfig();
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
}

function generateTtsAudio(textContent, styleHint) {
  return requestTtsWithRetry(textContent, styleHint, 2);
}

function requestTtsOnce(textContent, styleHint) {
  return new Promise((resolve, reject) => {
    const CONFIG = getTtsConfig();
    const payload = buildTtsRequest(textContent, styleHint);
    const postData = JSON.stringify(payload);
    const url = new URL(CONFIG.baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80),
      path: `${url.pathname.replace(/\/$/, '')}/chat/completions`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const status = res.statusCode || 0;
        const contentType = res.headers['content-type'] || '';
        try {
          const response = JSON.parse(data);
          if (response.detail) {
            reject(new Error(`API error: ${JSON.stringify(response.detail)}`));
            return;
          }
          const audioData = response.choices?.[0]?.message?.audio?.data;
          if (!audioData) {
            reject(new Error(`No audio data (status=${status}, content-type=${contentType})`));
            return;
          }
          const buffer = Buffer.from(audioData, 'base64');
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `cyber-gf-${timestamp}.mp3`;
          ensureOutputDir();
          const filepath = path.join(CONFIG.outputDir, filename);
          fs.writeFileSync(filepath, buffer);
          // Convert MP3 → OGG/OPUS for Telegram native voice bubble
          const oggFilename = `cyber-gf-${timestamp}.ogg`;
          const oggFilepath = path.join(CONFIG.outputDir, oggFilename);
          try {
            execFileSync('ffmpeg', ['-i', filepath, '-c:a', 'libopus', '-b:a', '32k', '-y', oggFilepath], { stdio: 'ignore' });
            resolve({ filename: oggFilename, filepath: oggFilepath, size: fs.statSync(oggFilepath).size, mp3Path: filepath });
          } catch (convErr) {
            // Fallback: send MP3 if ffmpeg conversion fails
            console.error('[cyber-gf tts] ogg conversion failed, fallback to mp3:', convErr.message);
            resolve({ filename, filepath, size: buffer.length });
          }
        } catch (err) {
          const preview = String(data).slice(0, 300).replace(/\s+/g, ' ');
          reject(new Error(`Parse error: ${err.message}; status=${status}; content-type=${contentType}; body=${preview}`));
        }
      });
    });

    req.on('error', err => reject(new Error(`Request error: ${err.message}`)));
    req.write(postData);
    req.end();
  });
}

async function requestTtsWithRetry(textContent, styleHint, attempts = 2) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await requestTtsOnce(textContent, styleHint);
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }
  throw lastError;
}

function generateFromLastTurn(state) {
  const last = state?.runtimeCache?.lastTurnTts;
  if (!last?.visibleText) {
    throw new Error('No cached TTS turn available');
  }
  return generateTtsAudio(last.visibleText, '');
}

async function probeTtsChain() {
  const testTagged = '（轻声，平稳）这是赛博女友模式启动前的语音链路自检。';
  const testPrompt = '保持自然、简短、不要夸张，只验证语音接口可正常返回音频。';
  return generateTtsAudio(testTagged, testPrompt);
}

module.exports = {
  buildTtsRequest,
  getTtsConfig,
  generateTtsAudio,
  generateFromLastTurn,
  requestTtsWithRetry,
  probeTtsChain
};
