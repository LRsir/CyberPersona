#!/usr/bin/env node
const fs = require('fs');
const { getConfig, ENV_PATH, validateConfig } = require('./config');
const {
  loadState,
  saveState,
  clearState,
  setModeEnabled,
  incrementSessionCount,
  applyTurnResult,
  setDebugEnabled,
  isDebugEnabled,
  storeLastGeneratedAudio,
  storeLastGeneratedImage,
  updateSessionStartTime,
  getCardFlatValues
} = require('./state');
const { buildInitialState, validateInitialProfile } = require('./profile');
const { validateTurnOutput, createFallbackTurnOutput } = require('./turn');

const { buildTurnAgentPrompt, buildDebugTurnAgentPrompt } = require('./prompts');
const { createGamificationSystem } = require('./gamification');
function getDefaultTelegramTarget() {
  return 'telegram';
}

function getHistoryPath() {
  return getConfig().historyFile;
}

function loadHistory() {
  try {
    const HISTORY_PATH = getHistoryPath();
    if (!fs.existsSync(HISTORY_PATH)) return [];
    return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function saveHistory(history) {
  const HISTORY_PATH = getHistoryPath();
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history.slice(-40), null, 2));
}

function appendHistory(role, text) {
  const history = loadHistory();
  history.push({ role, text, timestamp: new Date().toISOString() });
  saveHistory(history);
}

function getRecentContext(limit = 10) {
  return loadHistory().slice(-limit).map(({ role, text }) => ({ role, text }));
}

function formatStatus(state) {
  const dimLabel = (v) => v <= 20 ? '冰点' : v <= 40 ? '低' : v <= 60 ? '中' : v <= 80 ? '高' : '满';
  const dimLine = (label, v) => `${label}: ${v} (${dimLabel(v)})`;
  return [
    '💗 赛博女友状态',
    '========================',
    `已开启: ${state.mode.enabled ? '是' : '否'}`,
    `人设摘要: ${state.profile.profileSummary || '暂无'}`,
    `关系摘要: ${state.revealedMemory.lastSummary || '暂无'}`,
    dimLine('信任感', state.dynamicState.trust),
    dimLine('安全感', state.dynamicState.security),
    dimLine('亲密度', state.dynamicState.closeness),
    dimLine('需要感', state.dynamicState.neediness),
    dimLine('独占性', state.dynamicState.possessiveness),
    dimLine('压力值', state.stress ?? 20),
    `最近未解情绪: ${state.shortTermState.unresolvedEmotion}`,
    '========================'
  ].join('\n');
}

function buildTurnDebugInfo(turnOutput, forceDebug = false) {
  const state = loadState();
  const cfg = getConfig();
  if (!(forceDebug || isDebugEnabled(state) || cfg.debug.enabled)) return null;
  const lines = ['[cyber-gf debug]'];
  lines.push(`currentEmotion: ${turnOutput.currentEmotion}`);
  lines.push(`sendVoiceNow: ${turnOutput.sendVoiceNow ? 'true' : 'false'}`);
  lines.push(`sendImageNow: ${turnOutput.sendImageNow ? 'true' : 'false'}`);
  if (turnOutput.sendImageNow && turnOutput.imagePrompt) {
    lines.push(`imagePrompt: ${turnOutput.imagePrompt}`);
  }
  if (turnOutput.sendGifNow && turnOutput.gifKeyword) {
    lines.push(`sendGifNow: true`);
    lines.push(`gifKeyword: ${turnOutput.gifKeyword}`);
  }
  return lines.join('\n');
}

function setCyberGfDebug(flag) {
  const state = loadState();
  const base = state || {
    version: 1,
    runtimeCache: { debug: { enabled: false } }
  };
  const next = saveState(setDebugEnabled(base, flag));
  return {
    kind: 'debug_toggle',
    state: next,
    visibleText: `cyber-gf debug 已${flag ? '开启' : '关闭'}。`
  };
}

function getLastVoiceDeliveryInfo() {
  const state = loadState();
  if (!state?.runtimeCache?.lastTurnTts?.visibleText) {
    return {
      kind: 'voice_delivery_info',
      visibleText: '当前没有可发送的最近一轮语音缓存。'
    };
  }
  return {
    kind: 'voice_delivery_info',
    visibleText: [
      '[cyber-gf voice delivery]',
      'Telegram 语音条发送建议：使用 message 工具发送最近生成的音频文件，并设置 asVoice=true。',
      '这样比普通 MEDIA 附件更接近原生语音条。',
      '',
      '注意：是否显示为语音条，核心取决于发送接口语义，而不只是文件扩展名。'
    ].join('\n')
  };
}

function getLastGeneratedAudioInfo() {
  const state = loadState();
  const audio = state?.runtimeCache?.lastGeneratedAudio;
  if (!audio?.filepath) {
    return {
      kind: 'audio_info',
      visibleText: '当前还没有最近生成的语音文件记录。'
    };
  }
  return {
    kind: 'audio_info',
    visibleText: [
      '[cyber-gf last audio]',
      `filename: ${audio.filename}`,
      `filepath: ${audio.filepath}`,
      `size: ${audio.size}`,
      `createdAt: ${audio.createdAt}`
    ].join('\n')
  };
}

function buildVoiceSendPayloadFromAudio(audio, target = getDefaultTelegramTarget()) {
  if (!audio?.filepath) return null;
  return {
    action: 'send',
    channel: 'telegram',
    target,
    targets: [target],
    accountId: 'default',
    dryRun: false,
    message: '',
    media: audio.filepath,
    filename: audio.filename || '',
    caption: '',
    asVoice: true,
    silent: false,
    bestEffort: false
  };
}

function getTelegramVoiceSendPayload(target = getDefaultTelegramTarget()) {
  const state = loadState();
  const audio = state?.runtimeCache?.lastGeneratedAudio;
  if (!audio?.filepath) {
    return {
      kind: 'voice_send_payload',
      visibleText: '当前还没有最近生成的语音文件记录。'
    };
  }
  return {
    kind: 'voice_send_payload',
    payload: buildVoiceSendPayloadFromAudio(audio, target)
  };
}

function buildUnifiedDelivery(turnOutput, options = {}) {
  const state = loadState();
  const debugText = buildTurnDebugInfo(turnOutput, options.forceDebug);
  const target = options.target || getDefaultTelegramTarget();
  const audio = state?.runtimeCache?.lastGeneratedAudio;
  const voicePayload = turnOutput.sendVoiceNow ? buildVoiceSendPayloadFromAudio(audio, target) : null;
  const image = state?.runtimeCache?.lastGeneratedImage;
  const imagePayload = turnOutput.sendImageNow && image?.filepath ? {
    action: 'send',
    channel: 'telegram',
    target,
    targets: [target],
    accountId: 'default',
    dryRun: false,
    message: turnOutput.imageCaption || '',
    media: image.filepath,
    filename: image.filename || '',
    caption: turnOutput.imageCaption || '',
    asVoice: false,
    silent: false,
    bestEffort: false
  } : null;
  const gifPayload = (turnOutput.sendGifNow && turnOutput.gifKeyword)
    ? { sendGif: true, keyword: turnOutput.gifKeyword }
    : null;
  return {
    mode: voicePayload ? 'voice_note' : (imagePayload ? 'image_post' : 'text_reply'),
    text: debugText ? `${turnOutput.visibleText}\n\n${debugText}` : turnOutput.visibleText,
    sendVoiceNow: !!turnOutput.sendVoiceNow,
    sendImageNow: !!turnOutput.sendImageNow,
    voicePayload,
    imagePayload,
    gifPayload,
    imageCaption: turnOutput.imageCaption || '',
    shouldReplyInChat: !voicePayload,
    shouldNoReplyAfterMessageSend: !!(voicePayload || imagePayload),
    debugText: debugText || null
  };
}

function buildStartDelivery(openingMessage) {
  // 策略 3（观测者效应）：openingMessage 为空，显示等待提示
  const text = openingMessage && openingMessage.trim()
    ? openingMessage
    : '她正在线上...';
  return {
    mode: 'text_reply',
    text,
    sendVoiceNow: false,
    sendImageNow: false,
    voicePayload: null,
    imagePayload: null,
    imageCaption: '',
    shouldReplyInChat: true,
    shouldNoReplyAfterMessageSend: false,
    debugText: null
  };
}

function getLastTurnDebug() {
  const state = loadState();
  if (!state) {
    return {
      kind: 'debug',
      visibleText: '当前没有赛博女友状态记录。'
    };
  }
  const last = state.runtimeCache?.lastTurnTts;
  if (!last || !last.visibleText) {
    return {
      kind: 'debug',
      visibleText: '当前还没有最近一轮的语音调试信息。'
    };
  }
  return {
    kind: 'debug',
    visibleText: [
      '[cyber-gf debug]',
      `visibleText: ${last.visibleText}`,
      `currentEmotion: ${last.currentEmotion}`,
      `sendVoiceNow: ${last.sendVoiceNow ? 'true' : 'false'}`,
      `stateDelta: ${JSON.stringify(last.stateDelta || {})}`,
      `shortTermUpdate: ${JSON.stringify(last.shortTermUpdate || {})}`,
      `memoryUpdate: ${JSON.stringify(last.memoryUpdate || {})}`,
      ...(last.sendGifNow ? [`sendGifNow: true`, `gifKeyword: ${last.gifKeyword}`] : []),
      `timestamp: ${last.timestamp}`
    ].join('\n')
  };
}

function getStatePayload() {
  const state = loadState();
  return {
    state,
    recentContext: getRecentContext()
  };
}

// ── World Context (世界观同步) ──────────────────────────────────────
const WORLD_CACHE_PATH = require('path').join(__dirname, '..', 'data', 'world-cache.json');
const HOLIDAYS_PATH = require('path').join(__dirname, '..', 'data', 'holidays.json');
const WEATHER_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function getWeatherCache() {
  try {
    if (!fs.existsSync(WORLD_CACHE_PATH)) return null;
    const data = JSON.parse(fs.readFileSync(WORLD_CACHE_PATH, 'utf8'));
    if (Date.now() - (data._timestamp || 0) > WEATHER_CACHE_TTL) return null; // expired
    return data;
  } catch { return null; }
}

function saveWeatherCache(data) {
  try {
    data._timestamp = Date.now();
    fs.writeFileSync(WORLD_CACHE_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[world-sync] cache save error:', err.message);
  }
}

function fetchWeather(city) {
  try {
    const { execSync } = require('child_process');
    const raw = execSync(`curl -s -m 5 "https://wttr.in/${encodeURIComponent(city)}?format=j1"`, { encoding: 'utf8' });
    const data = JSON.parse(raw);
    const cur = data.current_condition?.[0];
    if (!cur) return null;
    const temp = cur.temp_C;
    const desc = cur.lang_zh?.[0]?.value || cur.weatherDesc?.[0]?.value || '';
    const feelsLike = cur.FeelsLikeC;
    const humidity = cur.humidity;
    return {
      city,
      temp: `${temp}°C`,
      desc,
      feelsLike: `${feelsLike}°C`,
      humidity: `${humidity}%`,
      summary: `${temp}°C ${desc}`
    };
  } catch { return null; }
}

function checkHolidays() {
  try {
    if (!fs.existsSync(HOLIDAYS_PATH)) return { today: null, upcoming: null };
    const data = JSON.parse(fs.readFileSync(HOLIDAYS_PATH, 'utf8'));
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const allHolidays = [...(data.fixed || []), ...(data.lunar_2026 || [])];
    let today = null;
    let upcoming = null;
    let minDaysAhead = Infinity;
    for (const h of allHolidays) {
      if (h.month === month && h.day === day) {
        today = h.name;
        break;
      }
      // Check if within "days_before" window
      const holidayDate = new Date(now.getFullYear(), h.month - 1, h.day);
      const diffMs = holidayDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > 0 && diffDays <= (h.days_before || 0) && diffDays < minDaysAhead) {
        minDaysAhead = diffDays;
        upcoming = diffDays === 1 ? `明天是${h.name}` : `还有${diffDays}天${h.name}`;
      }
    }
    return { today, upcoming };
  } catch { return { today: null, upcoming: null }; }
}

function getWorldContext(state) {
  // 量子态：locations.current 为 null 时不查天气（位置尚未坍缩）
  const currentCity = state?.revealedMemory?.locations?.current;
  let weather = null;
  if (currentCity) {
    // 优先读缓存
    const cached = getWeatherCache();
    if (cached && cached.city === currentCity) {
      weather = cached;
    } else {
      weather = fetchWeather(currentCity);
      if (weather) saveWeatherCache(weather);
    }
  }
  const holidays = checkHolidays();
  const result = {};
  if (weather) result.weather = weather.summary;
  if (holidays.today) result.holiday = holidays.today;
  if (holidays.upcoming) result.upcomingHoliday = holidays.upcoming;
  // 如果没有任何世界信息，返回 null（不注入）
  return Object.keys(result).length > 0 ? result : null;
}

/** 根据 appearance 标签直接拼装生图 prompt（不需要 LLM） */
function buildImagePrompt(appearance) {
  if (!appearance) return '';
  const parts = [
    '请生成一张高质量的年轻亚洲女性单人半身证件照。',
    '画面要求：正面面向镜头，光线自然，背景为纯色或极简环境。',
    '角色特征必须包含以下元素：',
  ];
  if (appearance.hair) parts.push(`发型：${appearance.hair}`);
  if (appearance.skin) parts.push(`肤色：${appearance.skin}`);
  if (appearance.eye) parts.push(`眼部：${appearance.eye}`);
  if (appearance.bodyType) parts.push(`身材特征：${appearance.bodyType}`);
  if (appearance.photoOutfit) parts.push(`当前穿着：${appearance.photoOutfit}`);
  return parts.join('\n');
}

function buildTurnContextPayload(userMessage) {
  const { state, recentContext } = getStatePayload();
  if (!state) return null;
  // 精简 profile：只保留 turn 需要的字段
  const p = state.profile || {};
  const slimProfile = {
    coreSummary: p.coreSummary,
    appearance: p.appearance,
    speechHabits: p.speechHabits,
    personalitySettings: state.personalitySettings || {},
    quirks: p.quirks,
    sessionSummaries: (p.sessionSummaries || []).slice(-3)
  };
  return {
    profile: slimProfile,
    dynamicState: state.dynamicState,
    shortTermState: state.shortTermState,
    revealedMemory: state.revealedMemory,
    characterCard: getCardFlatValues(state.characterCard || {}),
    worldContext: getWorldContext(state),
    recentContext: (recentContext || []).slice(-10),
    userMessage
  };
}

function buildStartPayload(seedData) {
  // v5: 种子脚本已包含所有数据（含 openingMessage），无需 LLM
  return {
    seed: seedData,
    note: '种子数据已完整，无需 LLM。agent 需要按顺序执行：1) 用 voiceStyle 调用 mimo_tts 生成音色样本；2) 调用 image-api skill 生成参考照片；3) 调用 applyStartPayload(payload) 落盘；4) 发送参考照 + 开场白 + 语音样本。'
  };
}

async function runHybridSelfCheck() {
  const configCheck = validateConfig();
  const result = {
    ok: false,
    issues: [],
    checks: {
      config: false,
      statePathWritable: false,
      historyPathWritable: false,
      ttsOutputWritable: false,
      modulesLoadable: false,
      ttsProbe: false
    }
  };

  if (!configCheck.ok) {
    result.issues.push(...configCheck.issues.map((x) => `${x.key}: ${x.message}`));
  } else {
    result.checks.config = true;
  }

  try {
    const cfg = getConfig();
    fs.mkdirSync(require('path').dirname(cfg.stateFile), { recursive: true });
    fs.writeFileSync(cfg.stateFile + '.check.tmp', 'ok');
    fs.unlinkSync(cfg.stateFile + '.check.tmp');
    result.checks.statePathWritable = true;
  } catch (err) {
    result.issues.push(`STATE_PATH_WRITABLE: ${err.message}`);
  }

  try {
    const cfg = getConfig();
    fs.mkdirSync(require('path').dirname(cfg.historyFile), { recursive: true });
    fs.writeFileSync(cfg.historyFile + '.check.tmp', 'ok');
    fs.unlinkSync(cfg.historyFile + '.check.tmp');
    result.checks.historyPathWritable = true;
  } catch (err) {
    result.issues.push(`HISTORY_PATH_WRITABLE: ${err.message}`);
  }

  try {
    const cfg = getConfig();
    fs.mkdirSync(cfg.ttsOutputDir, { recursive: true });
    fs.writeFileSync(require('path').join(cfg.ttsOutputDir, '.check.tmp'), 'ok');
    fs.unlinkSync(require('path').join(cfg.ttsOutputDir, '.check.tmp'));
    result.checks.ttsOutputWritable = true;
  } catch (err) {
    result.issues.push(`TTS_OUTPUT_WRITABLE: ${err.message}`);
  }

  try {
    require('./state');
    require('./profile');
    require('./turn');
    require('./prompts');
    result.checks.modulesLoadable = true;
  } catch (err) {
    result.issues.push(`MODULE_LOAD: ${err.message}`);
  }

  result.checks.ttsProbe = true;

  result.ok = Object.values(result.checks).every(Boolean);
  return result;
}

function formatConfigIssues(result) {
  const lines = [
    '赛博女友模式启动前自检未通过。',
    '',
    `请先创建并补全配置文件：${result.envPath}`,
    '',
    '缺少的项目：'
  ];
  for (const issue of result.issues) {
    lines.push(`- ${issue.key}: ${issue.message}`);
  }
  lines.push('', '补全后再次说“开始赛博女友”，我会重新自检。');
  return lines.join('\n');
}

function formatSelfCheckIssues(result) {
  const lines = [
    '赛博女友模式启动前自检未通过。',
    '',
    `请检查并补全配置文件：${ENV_PATH}`,
    '',
    '失败项目：'
  ];
  for (const issue of result.issues) {
    lines.push(`- ${issue}`);
  }
  lines.push('', '修复后再次说“开始赛博女友”，我会重新自检。');
  return lines.join('\n');
}

function readJsonArg(fileOrJson) {
  if (!fileOrJson) throw new Error('Missing JSON payload or file path');
  const trimmed = String(fileOrJson).trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  if (!fs.existsSync(trimmed)) throw new Error(`Payload file not found: ${trimmed}`);
  return JSON.parse(fs.readFileSync(trimmed, 'utf8'));
}

function buildTurnPayload(userMessage) {
  const start = Date.now();
  // 检测 debug+ 前缀
  if (userMessage && userMessage.startsWith('debug+')) {
    return buildDebugTurnPayload(userMessage.slice(6).trim());
  }
  const turnContext = buildTurnContextPayload(userMessage);
  if (!turnContext) return null;
  const elapsed = Date.now() - start;
  const timestamp = new Date().toISOString();
  console.error(`[perf] buildTurnPayload: ${timestamp} (${elapsed}ms)`);
  return {
    prompt: buildTurnAgentPrompt(turnContext),
    context: turnContext,
    envPath: ENV_PATH,
    _perfTimestamp: timestamp,
    note: '让 agent 生成 TurnResultPayload，然后调用 applyTurnResultPayload(payload, userMessage) 落盘。如 sendVoiceNow=true，agent 需直接调用 mimo_tts skill 脚本生成语音并发送（日常用 clone，唱歌用 preset），不再调用 speakLastTurn()。'
  };
}

/**
 * Build a debug turn payload. Ignores character constraints,
 * unconditionally executes the debug command, and forces debug display.
 */
function buildDebugTurnPayload(debugCommand) {
  const turnContext = buildTurnContextPayload(debugCommand);
  if (!turnContext) return null;
  return {
    prompt: buildDebugTurnAgentPrompt(turnContext, debugCommand),
    context: turnContext,
    envPath: ENV_PATH,
    isDebugCommand: true,
    debugCommand,
    note: '这是 debug+ 调试指令。agent 必须无条件执行，生成 TurnResultPayload 后调用 applyTurnResultPayload(payload, userMessage) 落盘。回复必须包含调试参数显示。'
  };
}

function applyInitialStatePayload(initialPayload) {
  const start = Date.now();
  const seed = initialPayload.seed || initialPayload;

  let state = buildInitialState(seed);
  state = saveState(state);
  const elapsed = Date.now() - start;
  const timestamp = new Date().toISOString();
  console.error(`[perf] applyInitialStatePayload: ${timestamp} (${elapsed}ms)`);
  return {
    state,
    openingMessage: seed.openingMessage || '',
    _perfTimestamp: timestamp
  };
}

function applyTurnResultPayload(turnResultPayload, userMessage = '') {
  const start = Date.now();
  const validated = validateTurnOutput(turnResultPayload);
  if (!validated.ok) {
    throw new Error(validated.error);
  }
  let state = loadState();
  if (!state) {
    throw new Error('No cyber girlfriend state exists');
  }
  if (userMessage) appendHistory('user', userMessage);
  appendHistory('assistant', validated.value.visibleText);
  state = applyTurnResult(state, validated.value);
  state.mode.enabled = true;

  // 游戏化系统检查
  let gamificationResult = null;
  try {
    const gamification = createGamificationSystem(state);
    // 记录互动类型
    const interactionType = validated.value.sendVoiceNow ? 'voice_message'
      : validated.value.sendImageNow ? 'photo_share'
      : 'daily_chat';
    gamification.recordInteraction(interactionType, {
      stateDelta: validated.value.stateDelta || {}
    });
    // 检查成就解锁
    gamificationResult = gamification.checkAll();
    // gamification managers modify state in-place via their references
  } catch (err) {
    console.error('[cyber-gf gamification] error:', err.message);
  }

  state = saveState(state);
  const elapsed = Date.now() - start;
  const timestamp = new Date().toISOString();
  console.error(`[perf] applyTurnResultPayload: ${timestamp} (${elapsed}ms)`);
  // debug+ 指令强制显示调试参数
  const isDebugCmd = userMessage && userMessage.startsWith('debug+');
  return {
    state,
    turnOutput: validated.value,
    debugText: buildTurnDebugInfo(validated.value, isDebugCmd),
    gamification: gamificationResult,
    _perfTimestamp: timestamp
  };
}

async function runStartFlow(initialPayload) {
  const applied = applyInitialStatePayload(initialPayload);
  return {
    kind: 'start_flow',
    applied,
    delivery: buildStartDelivery(applied.openingMessage)
  };
}

async function startCyberGfHybrid() {
  const configCheck = validateConfig();
  if (!configCheck.ok) {
    return {
      kind: 'config_incomplete',
      visibleText: formatConfigIssues(configCheck),
      configCheck
    };
  }
  const selfCheck = await runHybridSelfCheck();
  if (!selfCheck.ok) {
    return {
      kind: 'self_check_failed',
      visibleText: formatSelfCheckIssues(selfCheck),
      selfCheck
    };
  }
  // 屏蔽 gateway 长时间运行通知（赛博女友期间）
  try {
    const flagPath = require('os').homedir() + '/.hermes/.suppress_gateway_notify';
    fs.writeFileSync(flagPath, String(Date.now()));
  } catch {}
  let state = loadState();
  if (!state) {
    return {
      kind: 'need_profile_generation',
      ...buildStartPayload()
    };
  }
  state = incrementSessionCount(setModeEnabled(state, true));
  state = updateSessionStartTime(state);
  state = saveState(state);
  return {
    kind: 'restored',
    state,
    visibleText: `回来了。\n\n${state.profile.profileSummary}\n\n${state.revealedMemory.lastSummary}`
  };
}

function exitCyberGfHybrid() {
  const state = loadState();
  if (!state) {
    return {
      kind: 'noop',
      visibleText: '现在还没有赛博女友状态。'
    };
  }
  // 恢复 gateway 通知设置
  try {
    const flagPath = require('os').homedir() + '/.hermes/.suppress_gateway_notify';
    if (fs.existsSync(flagPath)) fs.unlinkSync(flagPath);
  } catch {}
  const next = saveState(setModeEnabled(state, false));
  return {
    kind: 'exited',
    state: next,
    visibleText: '已退出赛博女友模式，记忆已经保存。',
    note: '退出前请让 agent 生成 sessionSummary 并调用 apply-session-summary 保存。'
  };
}

function breakupCyberGfHybrid() {
  // 恢复 gateway 通知设置
  try {
    const flagPath = require('os').homedir() + '/.hermes/.suppress_gateway_notify';
    if (fs.existsSync(flagPath)) fs.unlinkSync(flagPath);
  } catch {}
  clearState();
  const historyPath = getHistoryPath();
  if (fs.existsSync(historyPath)) fs.unlinkSync(historyPath);
  return {
    kind: 'cleared',
    visibleText: '她安静了一下，然后真的走了。赛博女友的身份、关系和记忆都已经清空。'
  };
}

function getCyberGfStatus() {
  const state = loadState();
  if (!state) {
    return {
      kind: 'status',
      visibleText: '当前没有赛博女友状态记录。'
    };
  }

  // 游戏化状态
  let gamificationStatus = '';
  try {
    const gamification = createGamificationSystem(state);
    const gStatus = gamification.getStatus();
    const achievements = gStatus.achievements;
    const affection = gStatus.affection;
    const tasks = gStatus.dailyTasks;

    gamificationStatus = [
      '',
      '🎮 游戏化状态',
      '========================',
      `好感度: ${affection.current.points} (${affection.current.name} ${affection.current.icon}) ${affection.current.progress}%`,
      `成就: ${achievements.progress.unlocked}/${achievements.progress.total} (${achievements.progress.percentage}%)`,
      `今日任务: ${tasks.stats.todayCompleted}/${tasks.stats.totalTasks}`,
      '========================'
    ].join('\n');
  } catch {}

  return {
    kind: 'status',
    state,
    visibleText: formatStatus(state) + gamificationStatus
  };
}

function fallbackTurn(userMessage) {
  const output = createFallbackTurnOutput(userMessage);
  const applied = applyTurnResultPayload(output, userMessage);
  return {
    kind: 'fallback_turn',
    visibleText: output.visibleText,
    state: applied.state,
    turnOutput: output
  };
}

async function handleHybridCommand(command, arg = '') {
  if (command === 'start') return startCyberGfHybrid();
  if (command === 'exit') return exitCyberGfHybrid();
  if (command === 'breakup') return breakupCyberGfHybrid();
  if (command === 'status') return getCyberGfStatus();
  if (command === 'debug-last') return getLastTurnDebug();
  if (command === 'debug-on') return setCyberGfDebug(true);
  if (command === 'debug-off') return setCyberGfDebug(false);
  if (command === 'voice-delivery-info') return getLastVoiceDeliveryInfo();
  if (command === 'last-audio') return getLastGeneratedAudioInfo();
  if (command === 'voice-send-payload') return getTelegramVoiceSendPayload(arg || getDefaultTelegramTarget());
  if (command === 'run-start-flow') {
    const payload = readJsonArg(arg);
    return runStartFlow(payload);
  }
  if (command === 'turn-payload') {
    const payload = buildTurnPayload(arg || '在吗');
    if (!payload) {
      return {
        kind: 'error',
        visibleText: '赛博女友模式当前未开启，无法生成 turn payload。'
      };
    }
    return {
      kind: 'turn_payload',
      payload
    };
  }
  if (command === 'apply-start-payload') {
    const payload = readJsonArg(arg);
    const result = applyInitialStatePayload(payload);
    return {
      kind: 'applied_start_payload',
      visibleText: result.openingMessage,
      state: result.state
    };
  }
  if (command === 'apply-turn-payload') {
    const payload = readJsonArg(arg);
    const result = applyTurnResultPayload(payload, payload.__userMessage || '');
    return {
      kind: 'applied_turn_payload',
      visibleText: result.debugText ? `${result.turnOutput.visibleText}\n\n${result.debugText}` : result.turnOutput.visibleText,
      state: result.state,
      turnOutput: result.turnOutput
    };
  }
  if (command === 'fallback-turn') {
    return fallbackTurn(arg || '在吗');
  }
  if (command === 'apply-session-summary') {
    const summaryJson = readJsonArg(arg);
    let state = loadState();
    if (!state) {
      return { kind: 'error', visibleText: '赛博女友模式当前未开启。' };
    }
    if (!Array.isArray(state.profile.sessionSummaries)) {
      state.profile.sessionSummaries = [];
    }
    state.profile.sessionSummaries.push({
      date: summaryJson.date || new Date().toISOString().slice(0, 10),
      turnCount: summaryJson.turnCount || state.meta?.turnCount || 0,
      summary: summaryJson.summary || '',
      keyEvents: summaryJson.keyEvents || [],
      emotionalTone: summaryJson.emotionalTone || ''
    });
    // 保留最近5个
    if (state.profile.sessionSummaries.length > 5) {
      const merged = state.profile.sessionSummaries.slice(0, -5).map(s => s.summary).join('；');
      if (merged) {
        state.revealedMemory.importantEvents = state.revealedMemory.importantEvents || [];
        state.revealedMemory.importantEvents.push(`历史摘要: ${merged}`);
      }
      state.profile.sessionSummaries = state.profile.sessionSummaries.slice(-5);
    }
    state = saveState(state);
    return {
      kind: 'session_summary_applied',
      visibleText: 'sessionSummary 已保存。',
      state
    };
  }
  return {
    kind: 'error',
    visibleText: `未知命令: ${command}`
  };
}

async function main() {
  const arg1 = process.argv[2] || '';
  const arg2 = process.argv[3] || '';
  const commandMap = new Map([
    ['开始赛博女友', 'start'],
    ['退出赛博女友', 'exit'],
    ['我们分手吧', 'breakup'],
    ['status', 'status'],
    ['debug-last', 'debug-last'],
    ['debug-on', 'debug-on'],
    ['debug-off', 'debug-off'],
    ['voice-delivery-info', 'voice-delivery-info'],
    ['last-audio', 'last-audio'],
    ['voice-send-payload', 'voice-send-payload'],
    ['run-start-flow', 'run-start-flow'],
    ['turn-payload', 'turn-payload'],
    ['apply-start-payload', 'apply-start-payload'],
    ['apply-turn-payload', 'apply-turn-payload'],
    ['fallback-turn', 'fallback-turn'],
    ['apply-session-summary', 'apply-session-summary']
  ]);

  const command = commandMap.get(arg1);
  if (!command) {
    console.log('可用命令：开始赛博女友 / 退出赛博女友 / 我们分手吧 / status / debug-last / debug-on / debug-off / voice-delivery-info / last-audio / voice-send-payload / run-start-flow / turn-payload / apply-start-payload / apply-turn-payload / fallback-turn / apply-session-summary');
    process.exit(0);
  }

  const result = await handleHybridCommand(command, arg2);
  if (result.visibleText) {
    console.log(result.visibleText);
  } else if (result.payload) {
    console.log(JSON.stringify(result.payload, null, 2));
  } else if (result.note) {
    console.log(result.note);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}

module.exports = {
  getStatePayload,
  buildStartPayload,
  buildTurnPayload,
  buildImagePrompt,
  buildVoiceSendPayloadFromAudio,
  buildUnifiedDelivery,
  applyInitialStatePayload,
  applyTurnResultPayload,
  runStartFlow,
  startCyberGfHybrid,
  exitCyberGfHybrid,
  breakupCyberGfHybrid,
  getCyberGfStatus,
  fallbackTurn,
  handleHybridCommand
};