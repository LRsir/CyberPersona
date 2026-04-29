#!/usr/bin/env node
const fs = require('fs');
const { getConfig, ENV_PATH, validateConfig } = require('./cyber-gf-config');
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
  updateSessionStartTime
} = require('./cyber-gf-state');
const { buildInitialState, validateInitialProfile } = require('./cyber-gf-profile');
const { validateTurnOutput, createFallbackTurnOutput } = require('./cyber-gf-turn');
const { generateTtsAudio, generateFromLastTurn, probeTtsChain } = require('./cyber-gf-tts');
const { generateImageWithRetry, editImageWithRetry } = require('./cyber-gf-image');
const { buildInitialProfileAgentPrompt, buildTurnAgentPrompt, buildDebugTurnAgentPrompt } = require('./cyber-gf-prompts');
const { createGamificationSystem } = require('./cyber-gf-gamification');
const { createImageFileManager } = require('./cyber-gf-image-optimizer');

function getImageFileManager() {
  const cfg = getConfig();
  const dataDir = require('path').dirname(require('path').resolve(cfg.stateFile));
  return createImageFileManager(dataDir);
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

function getRecentContext(limit = 4) {
  return loadHistory().slice(-limit).map(({ role, text }) => ({ role, text }));
}

function formatStatus(state) {
  return [
    '💗 赛博女友状态',
    '========================',
    `已开启: ${state.mode.enabled ? '是' : '否'}`,
    `人设摘要: ${state.profile.profileSummary || '暂无'}`,
    `关系摘要: ${state.revealedMemory.lastSummary || '暂无'}`,
    `关系温度: ${state.dynamicState.relationshipWarmth}`,
    `安全感: ${state.dynamicState.safety}`,
    `信任感: ${state.dynamicState.trust}`,
    `主动靠近意愿: ${state.dynamicState.approachDesire}`,
    `暴露意愿: ${state.dynamicState.vulnerabilityWillingness}`,
    `语音自然度: ${state.dynamicState.voiceEase}`,
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
  if (forceDebug || cfg.debug.showTtsControls) {
    lines.push(`taggedTtsText: ${turnOutput.taggedTtsText}`);
    lines.push(`naturalStylePrompt: ${turnOutput.naturalStylePrompt}`);
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
  if (!state?.runtimeCache?.lastTurnTts?.taggedTtsText) {
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

function buildVoiceSendPayloadFromAudio(audio, target = 'telegram:8121382159') {
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

function getTelegramVoiceSendPayload(target = 'telegram:8121382159') {
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
  const target = options.target || 'telegram:8121382159';
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
  return {
    mode: voicePayload ? 'voice_note' : (imagePayload ? 'image_post' : 'text_reply'),
    text: debugText ? `${turnOutput.visibleText}\n\n${debugText}` : turnOutput.visibleText,
    sendVoiceNow: !!turnOutput.sendVoiceNow,
    sendImageNow: !!turnOutput.sendImageNow,
    voicePayload,
    imagePayload,
    imageCaption: turnOutput.imageCaption || '',
    shouldReplyInChat: !voicePayload,
    shouldNoReplyAfterMessageSend: !!(voicePayload || imagePayload),
    debugText: debugText || null
  };
}

function buildStartDelivery(openingMessage) {
  return {
    mode: 'text_reply',
    text: openingMessage,
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
      `taggedTtsText: ${last.taggedTtsText}`,
      `naturalStylePrompt: ${last.naturalStylePrompt}`,
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

function buildTurnContextPayload(userMessage) {
  const { state, recentContext } = getStatePayload();
  if (!state) return null;
  return {
    mode: state.mode,
    profile: state.profile,
    dynamicState: state.dynamicState,
    shortTermState: state.shortTermState,
    revealedMemory: state.revealedMemory,
    recentContext,
    userMessage
  };
}

function buildStartPayload() {
  return {
    prompt: buildInitialProfileAgentPrompt(),
    envPath: ENV_PATH,
    note: '让 agent 使用这个 prompt 生成 InitialStatePayload，然后调用 applyInitialStatePayload(payload) 即可落盘。落盘后必须调用 generateReferencePhoto() 生成人物参考照片，用于后续图片的人物一致性。'
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
    require('./cyber-gf-state');
    require('./cyber-gf-profile');
    require('./cyber-gf-turn');
    require('./cyber-gf-tts');
    require('./cyber-gf-prompts');
    result.checks.modulesLoadable = true;
  } catch (err) {
    result.issues.push(`MODULE_LOAD: ${err.message}`);
  }

  if (result.checks.config) {
    try {
      await probeTtsChain();
      result.checks.ttsProbe = true;
    } catch (err) {
      result.issues.push(`TTS_PROBE: ${err.message}`);
    }
  }

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
  // 检测 debug+ 前缀
  if (userMessage && userMessage.startsWith('debug+')) {
    return buildDebugTurnPayload(userMessage.slice(6).trim());
  }
  const turnContext = buildTurnContextPayload(userMessage);
  if (!turnContext) return null;
  return {
    prompt: buildTurnAgentPrompt(turnContext),
    context: turnContext,
    envPath: ENV_PATH,
    note: '让 agent 生成 TurnResultPayload，然后调用 applyTurnResultPayload(payload, userMessage) 落盘；如 sendVoiceNow=true，再调用 speakLastTurn()。'
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
  const validated = validateInitialProfile(initialPayload);
  if (!validated.ok) {
    throw new Error(validated.error);
  }
  let state = buildInitialState(validated.value);
  state = saveState(state);
  return {
    state,
    openingMessage: validated.value.openingMessage
  };
}

/**
 * Generate a reference ID photo from the character's appearance description.
 * This photo is used as the base for all subsequent character images (edit API).
 */
async function generateReferencePhoto() {
  const state = loadState();
  if (!state) throw new Error('No cyber girlfriend state exists');
  const appearance = state.profile.appearance;
  if (!appearance) throw new Error('No appearance description in profile');

  const prompt = `standard portrait photo, head and shoulders, neutral background, looking at camera, ${appearance}`;
  const image = await generateImageWithRetry(prompt, { size: '1024x1024', quality: 'high' });

  let currentState = loadState();
  currentState.profile.referencePhotoPath = image.filepath;
  currentState = saveState(currentState);

  // 记录到图片文件管理器
  try {
    const imgManager = getImageFileManager();
    imgManager.recordImage(image, { scene: 'reference', type: 'generate', prompt, isReference: true });
  } catch {}

  return {
    image,
    state: currentState,
    referencePhotoPath: image.filepath
  };
}

function applyTurnResultPayload(turnResultPayload, userMessage = '') {
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
    gamification.recordInteraction(interactionType);
    // 检查成就解锁
    gamificationResult = gamification.checkAll();
    // 回写状态（gamification 系统直接修改了 state 对象）
    state = gamification.state;
  } catch (err) {
    console.error('[cyber-gf gamification] error:', err.message);
  }

  state = saveState(state);
  // debug+ 指令强制显示调试参数
  const isDebugCmd = userMessage && userMessage.startsWith('debug+');
  return {
    state,
    turnOutput: validated.value,
    debugText: buildTurnDebugInfo(validated.value, isDebugCmd),
    gamification: gamificationResult
  };
}

/**
 * Generate a character image. Uses edit API with reference photo if available,
 * otherwise falls back to generate API. Ensures visual consistency.
 */
async function generateCharacterImage(imagePrompt) {
  const state = loadState();
  const refPath = state?.profile?.referencePhotoPath;
  const imgManager = getImageFileManager();
  let image;

  if (refPath && fs.existsSync(refPath)) {
    try {
      image = await editImageWithRetry(imagePrompt, refPath);
      imgManager.recordImage(image, { scene: 'character', type: 'edit', prompt: imagePrompt });
      return image;
    } catch (err) {
      console.error('[cyber-gf image] edit failed, falling back to generate:', err.message);
    }
  }

  image = await generateImageWithRetry(imagePrompt);
  imgManager.recordImage(image, { scene: 'character', type: 'generate', prompt: imagePrompt });
  return image;
}

async function speakLastTurn() {
  const state = loadState();
  if (!state) throw new Error('No cyber girlfriend state exists');
  const audio = await generateFromLastTurn(state);
  const next = saveState(storeLastGeneratedAudio(state, audio));
  return { ...audio, state: next };
}

async function speakTurnPayload(turnResultPayload) {
  const validated = validateTurnOutput(turnResultPayload);
  if (!validated.ok) {
    throw new Error(validated.error);
  }
  const audio = await generateTtsAudio(validated.value.taggedTtsText, validated.value.naturalStylePrompt);
  const state = loadState();
  if (state) saveState(storeLastGeneratedAudio(state, audio));
  let image = null;
  if (validated.value.sendImageNow && validated.value.imagePrompt) {
    try {
      image = await generateCharacterImage(validated.value.imagePrompt);
      const imgState = loadState();
      if (imgState) saveState(storeLastGeneratedImage(imgState, image));
    } catch (err) {
      console.error('[cyber-gf image] generation failed:', err.message);
    }
  }
  return { audio, image };
}

async function runTurnResultFlow(turnResultPayload, options = {}) {
  const userMessage = options.userMessage || turnResultPayload.__userMessage || '';
  const applied = applyTurnResultPayload(turnResultPayload, userMessage);
  let audio = null;
  let image = null;
  if (applied.turnOutput.sendVoiceNow) {
    const result = await speakTurnPayload(applied.turnOutput);
    audio = result.audio;
    image = result.image;
  } else if (applied.turnOutput.sendImageNow && applied.turnOutput.imagePrompt) {
    try {
      image = await generateCharacterImage(applied.turnOutput.imagePrompt);
      const imgState = loadState();
      if (imgState) saveState(storeLastGeneratedImage(imgState, image));
    } catch (err) {
      console.error('[cyber-gf image] generation failed:', err.message);
    }
  }
  const delivery = buildUnifiedDelivery(applied.turnOutput, {
    target: options.target,
    forceDebug: userMessage.startsWith('debug+')
  });
  return {
    kind: 'turn_flow',
    applied,
    audio,
    image,
    delivery
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
    visibleText: '已退出赛博女友模式，记忆已经保存。'
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

  // 图片统计
  let imageStats = '';
  try {
    const imgManager = getImageFileManager();
    const stats = imgManager.getStats();
    imageStats = [
      '',
      '📸 图片统计',
      '========================',
      `总图片: ${stats.total} (${stats.totalSizeMB} MB)`,
      `参考照片: ${stats.referencePhotos}`,
      `类型分布: ${JSON.stringify(stats.types)}`,
      '========================'
    ].join('\n');
  } catch {}

  return {
    kind: 'status',
    state,
    visibleText: formatStatus(state) + gamificationStatus + imageStats
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
  if (command === 'voice-send-payload') return getTelegramVoiceSendPayload(arg || 'telegram:8121382159');
  if (command === 'run-start-flow') {
    const payload = readJsonArg(arg);
    return runStartFlow(payload);
  }
  if (command === 'run-turn-flow') {
    const payload = readJsonArg(arg);
    return runTurnResultFlow(payload, { userMessage: payload.__userMessage || '', target: 'telegram:8121382159' });
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
  if (command === 'generate-reference-photo') {
    const result = await generateReferencePhoto();
    return {
      kind: 'reference_photo_generated',
      visibleText: `参考照片已生成: ${result.referencePhotoPath}`,
      ...result
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
  if (command === 'tts-last') {
    return {
      kind: 'tts_last',
      note: '请调用 speakLastTurn() 执行最近一轮语音生成。'
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
    ['run-turn-flow', 'run-turn-flow'],
    ['turn-payload', 'turn-payload'],
    ['apply-start-payload', 'apply-start-payload'],
    ['generate-reference-photo', 'generate-reference-photo'],
    ['apply-turn-payload', 'apply-turn-payload'],
    ['fallback-turn', 'fallback-turn']
  ]);

  const command = commandMap.get(arg1);
  if (!command) {
    console.log('可用命令：开始赛博女友 / 退出赛博女友 / 我们分手吧 / status / debug-last / debug-on / debug-off / voice-delivery-info / last-audio / voice-send-payload / run-start-flow / run-turn-flow / turn-payload / apply-start-payload / apply-turn-payload / fallback-turn');
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
  buildVoiceSendPayloadFromAudio,
  buildUnifiedDelivery,
  applyInitialStatePayload,
  applyTurnResultPayload,
  generateReferencePhoto,
  generateCharacterImage,
  speakLastTurn,
  speakTurnPayload,
  runStartFlow,
  runTurnResultFlow,
  startCyberGfHybrid,
  exitCyberGfHybrid,
  breakupCyberGfHybrid,
  getCyberGfStatus,
  fallbackTurn,
  handleHybridCommand
};