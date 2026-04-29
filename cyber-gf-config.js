const fs = require('fs');
const path = require('path');

const ENV_PATH = '/root/.openclaw/workspace/.env.cyber-gf';
let loaded = false;

function loadEnvFile() {
  if (loaded) return;
  loaded = true;
  if (!fs.existsSync(ENV_PATH)) return;
  const raw = fs.readFileSync(ENV_PATH, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function getConfig() {
  loadEnvFile();
  return {
    stateFile: process.env.CYBER_GF_STATE_FILE || '/root/.openclaw/workspace/.cyber-gf-state.json',
    historyFile: process.env.CYBER_GF_HISTORY_FILE || '/root/.openclaw/workspace/.cyber-gf-history.json',
    ttsOutputDir: process.env.CYBER_GF_TTS_OUTPUT_DIR || '/root/.openclaw/workspace/tts-cyber-gf',
    llm: {
      baseUrl: process.env.CYBER_GF_LLM_BASE_URL || '',
      apiKey: process.env.CYBER_GF_LLM_API_KEY || '',
      model: process.env.CYBER_GF_LLM_MODEL || 'openai/gpt-5.4',
      providerStyle: process.env.CYBER_GF_LLM_PROVIDER_STYLE || 'openai-compatible'
    },
    tts: {
      baseUrl: process.env.XIAOMI_BASE_URL || '',
      apiKey: process.env.XIAOMI_API_KEY || '',
      model: process.env.XIAOMI_TTS_MODEL || 'mimo-v2.5-tts',
      voice: process.env.XIAOMI_TTS_VOICE || '茉莉',
      format: process.env.XIAOMI_TTS_FORMAT || 'mp3'
    },
    debug: {
      enabled: /^(1|true|yes|on)$/i.test(process.env.CYBER_GF_DEBUG || ''),
      showTtsControls: /^(1|true|yes|on)$/i.test(process.env.CYBER_GF_DEBUG_TTS || process.env.CYBER_GF_DEBUG || '')
    }
  };
}

function validateConfig() {
  const config = getConfig();
  const issues = [];

  if (!config.tts.baseUrl) {
    issues.push({ key: 'XIAOMI_BASE_URL', message: '缺少 MiMo TTS base URL' });
  }
  if (!config.tts.apiKey) {
    issues.push({ key: 'XIAOMI_API_KEY', message: '缺少 MiMo TTS API key' });
  }
  if (!config.tts.model) {
    issues.push({ key: 'XIAOMI_TTS_MODEL', message: '缺少 MiMo TTS model' });
  }
  if (!config.tts.voice) {
    issues.push({ key: 'XIAOMI_TTS_VOICE', message: '缺少 MiMo TTS voice' });
  }

  return {
    ok: issues.length === 0,
    issues,
    config,
    envPath: ENV_PATH
  };
}

module.exports = {
  ENV_PATH,
  loadEnvFile,
  getConfig,
  validateConfig
};
