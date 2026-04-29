const fs = require('fs');
const { getConfig } = require('./cyber-gf-config');
const LEVELS = ['low', 'medium', 'high'];
const DELTAS = new Set(['slight_up', 'slight_down', 'keep']);

function nowIso() {
  return new Date().toISOString();
}

function getStatePath() {
  return getConfig().stateFile;
}

function createEmptyState() {
  return {
    version: 1,
    mode: {
      enabled: false,
      type: 'cyber_girlfriend'
    },
    meta: {
      createdAt: nowIso(),
      updatedAt: nowIso(),
      sessionCount: 0,
      turnCount: 0
    },
    profile: {
      coreSummary: '',
      relationshipSummary: '',
      defenseSummary: '',
      startSummary: '',
      voiceSummary: '',
      appearance: '',
      profileSummary: '',
      referencePhotoPath: ''
    },
    dynamicState: {
      relationshipWarmth: 'medium',
      safety: 'medium',
      trust: 'medium',
      approachDesire: 'medium',
      vulnerabilityWillingness: 'medium',
      voiceEase: 'low'
    },
    shortTermState: {
      unresolvedEmotion: 'none',
      interactionTrend: 'steady',
      recentVoicePattern: 'none',
      recentImagePattern: 'none'
    },
    revealedMemory: {
      nicknameForUser: null,
      nicknameForSelf: null,
      sharedRoutines: [],
      revealedFacts: [],
      importantEvents: [],
      lastSummary: ''
    },
    runtimeCache: {
      debug: {
        enabled: false
      },
      voiceCount: 0,
      imageCount: 0,
      sessionStartTime: '',
      lastInteractionTime: '',
      lateNightChat: false,
      earlyMorningChat: false,
      longChatSession: false,
      achievements: [],
      affectionPoints: 0,
      dailyTasks: {},
      collections: {
        photos: [],
        voices: [],
        memories: [],
        achievements: []
      },
      lastGeneratedAudio: {
        filename: '',
        filepath: '',
        size: 0,
        createdAt: ''
      },
      lastTurnTts: {
        visibleText: '',
        taggedTtsText: '',
        naturalStylePrompt: '',
        currentEmotion: '',
        sendVoiceNow: false,
        sendImageNow: false,
        imagePrompt: '',
        imageCaption: '',
        timestamp: '',
        stateDelta: {},
        shortTermUpdate: {},
        memoryUpdate: {}
      },
      lastGeneratedImage: {
        filename: '',
        filepath: '',
        size: 0,
        createdAt: ''
      }
    }
  };
}

function repairState(state) {
  const base = createEmptyState();
  const repaired = {
    ...base,
    ...state,
    mode: { ...base.mode, ...(state?.mode || {}) },
    meta: { ...base.meta, ...(state?.meta || {}) },
    profile: { ...base.profile, ...(state?.profile || {}) },
    dynamicState: { ...base.dynamicState, ...(state?.dynamicState || {}) },
    shortTermState: { ...base.shortTermState, ...(state?.shortTermState || {}) },
    revealedMemory: { ...base.revealedMemory, ...(state?.revealedMemory || {}) },
    runtimeCache: {
      ...base.runtimeCache,
      ...(state?.runtimeCache || {}),
      debug: {
        ...base.runtimeCache.debug,
        ...(state?.runtimeCache?.debug || {})
      },
      lastGeneratedAudio: {
        ...base.runtimeCache.lastGeneratedAudio,
        ...(state?.runtimeCache?.lastGeneratedAudio || {})
      },
      lastTurnTts: {
        ...base.runtimeCache.lastTurnTts,
        ...(state?.runtimeCache?.lastTurnTts || {})
      },
      lastGeneratedImage: {
        ...base.runtimeCache.lastGeneratedImage,
        ...(state?.runtimeCache?.lastGeneratedImage || {})
      }
    }
  };

  for (const key of Object.keys(repaired.dynamicState)) {
    if (!LEVELS.includes(repaired.dynamicState[key])) repaired.dynamicState[key] = base.dynamicState[key];
  }

  return repaired;
}

function loadState() {
  try {
    const STATE_PATH = getStatePath();
    if (!fs.existsSync(STATE_PATH)) return null;
    const raw = fs.readFileSync(STATE_PATH, 'utf8');
    return repairState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function saveState(state) {
  const STATE_PATH = getStatePath();
  const next = repairState(state);
  next.meta.updatedAt = nowIso();
  fs.writeFileSync(STATE_PATH, JSON.stringify(next, null, 2));
  return next;
}

function clearState() {
  const STATE_PATH = getStatePath();
  if (fs.existsSync(STATE_PATH)) fs.unlinkSync(STATE_PATH);
}

function setModeEnabled(state, enabled) {
  const next = repairState(state);
  next.mode.enabled = !!enabled;
  return next;
}

function incrementSessionCount(state) {
  const next = repairState(state);
  next.meta.sessionCount += 1;
  return next;
}

function incrementTurnCount(state) {
  const next = repairState(state);
  next.meta.turnCount += 1;
  return next;
}

function applyOneLevel(current, delta) {
  const index = LEVELS.indexOf(current);
  if (index === -1 || !DELTAS.has(delta)) return current;
  if (delta === 'keep') return current;
  if (delta === 'slight_up') return LEVELS[Math.min(index + 1, LEVELS.length - 1)];
  return LEVELS[Math.max(index - 1, 0)];
}

function applyStateDelta(dynamicState, stateDelta = {}) {
  const current = { ...createEmptyState().dynamicState, ...(dynamicState || {}) };
  const next = { ...current };
  for (const key of Object.keys(current)) {
    next[key] = applyOneLevel(current[key], stateDelta[key] || 'keep');
  }
  return next;
}

function applyShortTermUpdate(shortTermState, shortTermUpdate = {}) {
  const current = { ...createEmptyState().shortTermState, ...(shortTermState || {}) };
  return {
    unresolvedEmotion: typeof shortTermUpdate.unresolvedEmotion === 'string' && shortTermUpdate.unresolvedEmotion.trim()
      ? shortTermUpdate.unresolvedEmotion.trim()
      : current.unresolvedEmotion,
    interactionTrend: typeof shortTermUpdate.interactionTrend === 'string' && shortTermUpdate.interactionTrend.trim()
      ? shortTermUpdate.interactionTrend.trim()
      : current.interactionTrend,
    recentVoicePattern: typeof shortTermUpdate.recentVoicePattern === 'string' && shortTermUpdate.recentVoicePattern.trim()
      ? shortTermUpdate.recentVoicePattern.trim()
      : current.recentVoicePattern,
    recentImagePattern: typeof shortTermUpdate.recentImagePattern === 'string' && shortTermUpdate.recentImagePattern.trim()
      ? shortTermUpdate.recentImagePattern.trim()
      : current.recentImagePattern
  };
}

function dedupeStrings(items = []) {
  return [...new Set(items.filter(Boolean).map((x) => String(x).trim()).filter(Boolean))];
}

function mergeRevealedFacts(oldFacts = [], newFacts = []) {
  const byKey = new Map();
  for (const fact of oldFacts) {
    if (fact && fact.key && fact.value) byKey.set(String(fact.key), { key: String(fact.key), value: String(fact.value) });
  }
  for (const fact of newFacts || []) {
    if (!fact || !fact.key || !fact.value) continue;
    const key = String(fact.key);
    const value = String(fact.value);
    if (!byKey.has(key)) {
      byKey.set(key, { key, value });
      continue;
    }
    const current = byKey.get(key);
    if (current.value === value) continue;
    // 第一版不允许冲突覆盖，保留旧值
  }
  return [...byKey.values()];
}

function mergeMemoryUpdate(revealedMemory, memoryUpdate = {}) {
  const current = { ...createEmptyState().revealedMemory, ...(revealedMemory || {}) };
  const next = { ...current };

  if (typeof memoryUpdate.nicknameForUser === 'string' && memoryUpdate.nicknameForUser.trim()) {
    next.nicknameForUser = memoryUpdate.nicknameForUser.trim();
  }
  if (typeof memoryUpdate.nicknameForSelf === 'string' && memoryUpdate.nicknameForSelf.trim()) {
    next.nicknameForSelf = memoryUpdate.nicknameForSelf.trim();
  }

  next.sharedRoutines = dedupeStrings([...(current.sharedRoutines || []), ...(memoryUpdate.sharedRoutinesAdd || [])]);
  next.importantEvents = dedupeStrings([...(current.importantEvents || []), ...(memoryUpdate.importantEventsAdd || [])]).slice(-20);
  next.revealedFacts = mergeRevealedFacts(current.revealedFacts || [], memoryUpdate.revealedFactsAdd || []);

  if (typeof memoryUpdate.lastSummary === 'string' && memoryUpdate.lastSummary.trim()) {
    next.lastSummary = memoryUpdate.lastSummary.trim();
  }

  return next;
}

function storeLastTurnTts(state, turnOutput) {
  const next = repairState(state);
  next.runtimeCache.lastTurnTts = {
    visibleText: turnOutput.visibleText || '',
    taggedTtsText: turnOutput.taggedTtsText || '',
    naturalStylePrompt: turnOutput.naturalStylePrompt || '',
    currentEmotion: turnOutput.currentEmotion || '',
    sendVoiceNow: !!turnOutput.sendVoiceNow,
    sendImageNow: !!turnOutput.sendImageNow,
    imagePrompt: turnOutput.imagePrompt || '',
    imageCaption: turnOutput.imageCaption || '',
    timestamp: nowIso(),
    stateDelta: turnOutput.stateDelta || {},
    shortTermUpdate: turnOutput.shortTermUpdate || {},
    memoryUpdate: turnOutput.memoryUpdate || {}
  };
  return next;
}

function storeLastGeneratedAudio(state, audioResult) {
  const next = repairState(state);
  next.runtimeCache.lastGeneratedAudio = {
    filename: audioResult?.filename || '',
    filepath: audioResult?.filepath || '',
    size: Number(audioResult?.size || 0),
    createdAt: nowIso()
  };
  return next;
}

function storeLastGeneratedImage(state, imageResult) {
  const next = repairState(state);
  next.runtimeCache.lastGeneratedImage = {
    filename: imageResult?.filename || '',
    filepath: imageResult?.filepath || '',
    size: Number(imageResult?.size || 0),
    createdAt: nowIso()
  };
  return next;
}

function setDebugEnabled(state, enabled) {
  const next = repairState(state);
  next.runtimeCache.debug.enabled = !!enabled;
  return next;
}

function isDebugEnabled(state) {
  const repaired = repairState(state || {});
  const cfg = getConfig();
  return !!(repaired.runtimeCache?.debug?.enabled || cfg.debug.enabled);
}

function applyTurnResult(state, turnOutput) {
  let next = repairState(state);
  next.dynamicState = applyStateDelta(next.dynamicState, turnOutput.stateDelta || {});
  next.shortTermState = applyShortTermUpdate(next.shortTermState, turnOutput.shortTermUpdate || {});
  next.revealedMemory = mergeMemoryUpdate(next.revealedMemory, turnOutput.memoryUpdate || {});
  next = storeLastTurnTts(next, turnOutput);
  next = incrementTurnCount(next);

  // 更新运行时计数和时间检测
  const now = new Date();
  const hour = now.getHours();
  next.runtimeCache.lastInteractionTime = now.toISOString();

  if (turnOutput.sendVoiceNow) {
    next.runtimeCache.voiceCount = (next.runtimeCache.voiceCount || 0) + 1;
  }
  if (turnOutput.sendImageNow) {
    next.runtimeCache.imageCount = (next.runtimeCache.imageCount || 0) + 1;
  }

  // 时间检测
  if (hour >= 2 && hour < 5) {
    next.runtimeCache.lateNightChat = true;
  }
  if (hour >= 6 && hour < 7) {
    next.runtimeCache.earlyMorningChat = true;
  }

  // 长时间聊天检测（session 开始到当前超过 4 小时）
  const sessionStart = next.runtimeCache.sessionStartTime;
  if (sessionStart) {
    const elapsed = (now.getTime() - new Date(sessionStart).getTime()) / (1000 * 60 * 60);
    if (elapsed >= 4) {
      next.runtimeCache.longChatSession = true;
    }
  }

  return next;
}

/**
 * 更新会话开始时间（在 startCyberGfHybrid 中调用）
 */
function updateSessionStartTime(state) {
  const next = repairState(state);
  if (!next.runtimeCache.sessionStartTime) {
    next.runtimeCache.sessionStartTime = new Date().toISOString();
  }
  // 重置每会话的时间检测标志
  next.runtimeCache.lateNightChat = false;
  next.runtimeCache.earlyMorningChat = false;
  next.runtimeCache.longChatSession = false;
  return next;
}

module.exports = {
  LEVELS,
  getStatePath,
  createEmptyState,
  repairState,
  loadState,
  saveState,
  clearState,
  setModeEnabled,
  incrementSessionCount,
  incrementTurnCount,
  applyStateDelta,
  applyShortTermUpdate,
  mergeMemoryUpdate,
  storeLastTurnTts,
  storeLastGeneratedAudio,
  storeLastGeneratedImage,
  setDebugEnabled,
  isDebugEnabled,
  applyTurnResult,
  updateSessionStartTime
};
