const fs = require('fs');
const { getConfig } = require('./cyber-gf-config');

function nowIso() {
  return new Date().toISOString();
}

function getTimeOfDay() {
  const hour = new Date().getHours();
  let period, label;
  if (hour >= 6 && hour < 9)       { period = 'morning_early'; label = '早晨'; }
  else if (hour >= 9 && hour < 12) { period = 'morning';       label = '上午'; }
  else if (hour >= 12 && hour < 14){ period = 'noon';          label = '中午'; }
  else if (hour >= 14 && hour < 18){ period = 'afternoon';     label = '下午'; }
  else if (hour >= 18 && hour < 22){ period = 'evening';       label = '晚上'; }
  else if (hour >= 22)             { period = 'night';         label = '深夜'; }
  else                             { period = 'late_night';    label = '凌晨'; }
  return `${label}(${hour}:00, ${period})`;
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
      referencePhotoPath: '',
      emotionalProfile: {
        baseline: '',
        vulnerabilityTopics: []
      },
      sessionSummaries: []
    },
    personalitySettings: {
      neuroticism: 50,
      agreeableness: 50,
      openness: 50,
      conscientiousness: 50,
      extraversion: 50
    },
    dynamicState: {
      trust: 30,
      security: 30,
      closeness: 15,
      neediness: 15,
      possessiveness: 10
    },
    stress: 20,
    shortTermState: {
      unresolvedEmotion: 'none',
      interactionTrend: 'steady',
      recentVoicePattern: 'none',
      recentImagePattern: 'none',
      emotionHistory: [],
      moodFactors: {
        timeOfDay: '',
        chatDuration: '',
        recentEmotionTrend: ''
      }
    },
    revealedMemory: {
      nicknameForUser: null,
      nicknameForSelf: null,
      sharedRoutines: [],
      revealedFacts: [],
      importantEvents: [],
      lastSummary: '',
      emotionalMemories: [],
      locations: {
        current: null,
        history: []
      },
      emotionalExpression: {},
      vulnerabilityTopics: []
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
        currentEmotion: '',
        sendVoiceNow: false,
        sendImageNow: false,
        sendGifNow: false,
        gifKeyword: '',
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
    profile: {
      ...base.profile,
      ...(state?.profile || {}),
      emotionalProfile: {
        ...base.profile.emotionalProfile,
        ...(state?.profile?.emotionalProfile || {})
      },
      sessionSummaries: Array.isArray(state?.profile?.sessionSummaries) ? state.profile.sessionSummaries : []
    },
    personalitySettings: { ...base.personalitySettings, ...(state?.personalitySettings || {}) },
    dynamicState: { ...base.dynamicState, ...(state?.dynamicState || {}) },
    stress: typeof state?.stress === 'number' ? state.stress : base.stress,
    shortTermState: {
      ...base.shortTermState,
      ...(state?.shortTermState || {}),
      emotionHistory: Array.isArray(state?.shortTermState?.emotionHistory) ? state.shortTermState.emotionHistory : [],
      moodFactors: {
        ...base.shortTermState.moodFactors,
        ...(state?.shortTermState?.moodFactors || {})
      }
    },
    revealedMemory: {
      ...base.revealedMemory,
      ...(state?.revealedMemory || {}),
      emotionalMemories: Array.isArray(state?.revealedMemory?.emotionalMemories) ? state.revealedMemory.emotionalMemories : []
    },
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

  // Validate personalitySettings (L2): all values must be integers in 0-100
  if (!repaired.personalitySettings || typeof repaired.personalitySettings !== 'object') {
    repaired.personalitySettings = { ...base.personalitySettings };
  }
  for (const key of Object.keys(base.personalitySettings)) {
    const val = repaired.personalitySettings[key];
    if (typeof val !== 'number' || isNaN(val)) {
      repaired.personalitySettings[key] = base.personalitySettings[key];
    } else {
      repaired.personalitySettings[key] = Math.round(Math.max(0, Math.min(100, val)));
    }
  }

  // Validate dynamicState (L3): all values must be integers in 0-100
  for (const key of Object.keys(base.dynamicState)) {
    const val = repaired.dynamicState[key];
    if (typeof val !== 'number' || isNaN(val)) {
      repaired.dynamicState[key] = base.dynamicState[key];
    } else {
      repaired.dynamicState[key] = Math.round(Math.max(0, Math.min(100, val)));
    }
  }

  // Validate stress: integer 0-100
  if (typeof repaired.stress !== 'number' || isNaN(repaired.stress)) {
    repaired.stress = base.stress;
  } else {
    repaired.stress = Math.round(Math.max(0, Math.min(100, repaired.stress)));
  }

  // Validate emotionHistory: must be array of {emotion, trigger} with max 3
  if (!Array.isArray(repaired.shortTermState.emotionHistory)) {
    repaired.shortTermState.emotionHistory = [];
  }
  repaired.shortTermState.emotionHistory = repaired.shortTermState.emotionHistory.slice(-3);

  // Validate emotionalMemories: must be array, max 20
  if (!Array.isArray(repaired.revealedMemory.emotionalMemories)) {
    repaired.revealedMemory.emotionalMemories = [];
  }
  repaired.revealedMemory.emotionalMemories = repaired.revealedMemory.emotionalMemories.slice(-20);

  // Validate locations: must have current (string|null) and history (array)
  if (!repaired.revealedMemory.locations || typeof repaired.revealedMemory.locations !== 'object') {
    repaired.revealedMemory.locations = { current: null, history: [] };
  }
  if (typeof repaired.revealedMemory.locations.current !== 'string' && repaired.revealedMemory.locations.current !== null) {
    repaired.revealedMemory.locations.current = null;
  }
  if (!Array.isArray(repaired.revealedMemory.locations.history)) {
    repaired.revealedMemory.locations.history = [];
  }
  repaired.revealedMemory.locations.history = repaired.revealedMemory.locations.history.slice(-10);

  // Validate emotionalExpression: must be object
  if (!repaired.revealedMemory.emotionalExpression || typeof repaired.revealedMemory.emotionalExpression !== 'object' || Array.isArray(repaired.revealedMemory.emotionalExpression)) {
    repaired.revealedMemory.emotionalExpression = {};
  }

  // Validate vulnerabilityTopics: must be array, max 10
  if (!Array.isArray(repaired.revealedMemory.vulnerabilityTopics)) {
    repaired.revealedMemory.vulnerabilityTopics = [];
  }
  repaired.revealedMemory.vulnerabilityTopics = repaired.revealedMemory.vulnerabilityTopics.slice(-10);

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

// ── 数值系统：枚举映射 + L2 调制 + 情绪系数 ─────────────────
const ENUM_TO_INT = {
  'major_decrease': -10,
  'minor_decrease': -3,
  'neutral': 0,
  'minor_increase': 3,
  'major_increase': 10
};

function enumToInt(val) {
  if (typeof val === 'number') return val; // backward compat
  return ENUM_TO_INT[val] ?? 0;
}

function getL2Factor(dimensionKey, personalitySettings) {
  const ps = personalitySettings || {};
  const n = ps.neuroticism ?? 50;
  const a = ps.agreeableness ?? 50;
  const o = ps.openness ?? 50;
  const c = ps.conscientiousness ?? 50;
  const e = ps.extraversion ?? 50;

  // neuroticism affects ALL dimensions as a base multiplier
  const baseFactor = 0.5 + (n / 100); // 0.5 ~ 1.5

  switch (dimensionKey) {
    case 'trust':
      // agreeableness + conscientiousness affect trust
      return baseFactor * (0.5 + (a + c) / 200); // ~0.75 ~ 2.0
    case 'security':
      // neuroticism dominates security (high N = security drops faster)
      return baseFactor; // 0.5 ~ 1.5
    case 'closeness':
      // extraversion + openness affect closeness growth
      return baseFactor * (0.5 + (e + o) / 200); // ~0.75 ~ 2.0
    case 'neediness':
      // low extraversion = high neediness sensitivity (N already in baseFactor)
      return baseFactor * (0.5 + (100 - e) / 200); // ~0.75 ~ 1.75
    case 'possessiveness':
      // low agreeableness = high possessiveness (N already in baseFactor)
      return baseFactor * (0.5 + (100 - a) / 200); // ~0.75 ~ 1.75
    default:
      return baseFactor;
  }
}

function getMoodFactor(stress, isPositive) {
  const stressed = (stress || 0) / 100; // 0 ~ 1
  if (isPositive) {
    return Math.max(0.5, 1 - 0.5 * stressed); // 0.5 ~ 1.0
  } else {
    return 1 + 0.5 * stressed; // 1.0 ~ 1.5
  }
}

function applyStateDelta(dynamicState, stateDelta = {}, personalitySettings, stress) {
  const current = { ...createEmptyState().dynamicState, ...(dynamicState || {}) };
  const next = { ...current };
  for (const key of Object.keys(next)) {
    const rawDelta = enumToInt(stateDelta[key]);
    if (rawDelta === 0) continue;
    const l2Factor = getL2Factor(key, personalitySettings);
    const isPositive = rawDelta > 0;
    const moodFactor = getMoodFactor(stress, isPositive);
    const effectiveDelta = Math.round(rawDelta * l2Factor * moodFactor);
    next[key] = Math.max(0, Math.min(100, current[key] + effectiveDelta));
  }
  return next;
}

function applyStressDelta(currentStress, stressDelta, personalitySettings) {
  const rawDelta = enumToInt(stressDelta);
  if (rawDelta === 0) return currentStress;
  // neuroticism amplifies stress changes
  const n = (personalitySettings?.neuroticism ?? 50) / 100; // 0 ~ 1
  const factor = 0.5 + n; // 0.5 ~ 1.5
  const effective = Math.round(rawDelta * factor);
  return Math.max(0, Math.min(100, (currentStress || 0) + effective));
}

function decayStress(currentStress, personalitySettings) {
  const ps = personalitySettings || {};
  const n = ps.neuroticism ?? 50;
  const c = ps.conscientiousness ?? 50;
  // low N + high C = faster recovery
  const recoveryRate = 2 + Math.round((100 - n) / 25 + c / 50); // 2~8 per turn
  return Math.max(0, (currentStress || 0) - recoveryRate);
}

function applyShortTermUpdate(shortTermState, shortTermUpdate = {}) {
  const current = { ...createEmptyState().shortTermState, ...(shortTermState || {}) };
  const result = {
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
      : current.recentImagePattern,
    emotionHistory: Array.isArray(current.emotionHistory) ? [...current.emotionHistory] : [],
    moodFactors: { ...current.moodFactors }
  };

  // Handle emotionHistory: if shortTermUpdate provides emotion entries, append them
  if (Array.isArray(shortTermUpdate.emotionHistoryAdd)) {
    for (const entry of shortTermUpdate.emotionHistoryAdd) {
      if (entry && entry.emotion) {
        result.emotionHistory.push({ emotion: entry.emotion, trigger: entry.trigger || '' });
      }
    }
    result.emotionHistory = result.emotionHistory.slice(-3);
  }

  // Handle moodFactors updates
  if (shortTermUpdate.moodFactors) {
    const mf = shortTermUpdate.moodFactors;
    if (typeof mf.chatDuration === 'string' && mf.chatDuration.trim()) {
      result.moodFactors.chatDuration = mf.chatDuration.trim();
    }
    if (typeof mf.recentEmotionTrend === 'string' && mf.recentEmotionTrend.trim()) {
      result.moodFactors.recentEmotionTrend = mf.recentEmotionTrend.trim();
    }
  }

  // Auto-calculate timeOfDay
  result.moodFactors.timeOfDay = getTimeOfDay();

  return result;
}

function dedupeStrings(items = []) {
  return [...new Set(items.filter(Boolean).map((x) => String(x).trim()).filter(Boolean))];
}

function mergeRevealedFacts(oldFacts = [], newFacts = []) {
  const byKey = new Map();
  for (const fact of oldFacts) {
    if (fact && fact.key && fact.value) {
      byKey.set(String(fact.key), {
        key: String(fact.key),
        value: String(fact.value),
        type: fact.type || 'setting',
        revisions: Array.isArray(fact.revisions) ? fact.revisions : []
      });
    }
  }
  for (const fact of newFacts || []) {
    if (!fact || !fact.key || !fact.value) continue;
    const key = String(fact.key);
    const value = String(fact.value);
    const type = fact.type || 'setting'; // 默认 setting（不可变）
    if (!byKey.has(key)) {
      byKey.set(key, { key, value, type, revisions: [] });
      continue;
    }
    const current = byKey.get(key);
    if (current.value === value) continue;
    // 冲突处理：setting 保留旧值，experience 覆盖并记录修订
    if (type === 'experience' || current.type === 'experience') {
      // experience 类：覆盖旧值，旧值进 revision 历史
      current.revisions.push({ value: current.value, timestamp: new Date().toISOString() });
      current.value = value;
      current.type = 'experience';
    }
    // setting 类冲突：保留旧值，不做任何操作
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

  // Handle emotionalMemories: append, dedupe by event text, keep last 20
  const existingEmoMemories = Array.isArray(current.emotionalMemories) ? [...current.emotionalMemories] : [];
  const newEmoMemories = Array.isArray(memoryUpdate.emotionalMemoriesAdd) ? memoryUpdate.emotionalMemoriesAdd : [];
  if (newEmoMemories.length > 0) {
    const seen = new Set(existingEmoMemories.map(m => (m && m.event) ? String(m.event).trim() : '').filter(Boolean));
    for (const mem of newEmoMemories) {
      if (!mem || !mem.event) continue;
      const eventText = String(mem.event).trim();
      if (eventText && !seen.has(eventText)) {
        seen.add(eventText);
        existingEmoMemories.push({ event: eventText, emotion: mem.emotion || '', timestamp: mem.timestamp || nowIso() });
      }
    }
    next.emotionalMemories = existingEmoMemories.slice(-20);
  }

  // Handle locations (量子态：提及即坍缩)
  if (memoryUpdate.locationUpdate && typeof memoryUpdate.locationUpdate === 'object') {
    const loc = memoryUpdate.locationUpdate;
    if (!next.locations) next.locations = { current: null, history: [] };
    // 如果是旅行/出差，先把当前位置记入历史
    if (loc.travel && typeof loc.travel === 'string' && loc.travel.trim()) {
      if (next.locations.current) {
        next.locations.history.push({ city: next.locations.current, timestamp: nowIso() });
      }
      next.locations.current = loc.travel.trim();
    }
    // 如果直接设置了 current（回来/定居）
    if (loc.current && typeof loc.current === 'string' && loc.current.trim()) {
      // 如果之前有不同位置且没有 travel，记录历史
      if (next.locations.current && next.locations.current !== loc.current.trim()) {
        next.locations.history.push({ city: next.locations.current, timestamp: nowIso() });
      }
      next.locations.current = loc.current.trim();
    }
  }

  // Handle emotionalExpression (量子态：首次经历时坍缩)
  if (memoryUpdate.emotionalExpressionAdd && typeof memoryUpdate.emotionalExpressionAdd === 'object') {
    const expr = memoryUpdate.emotionalExpressionAdd;
    if (expr.emotion && expr.expression && typeof expr.emotion === 'string' && typeof expr.expression === 'string') {
      if (!next.emotionalExpression) next.emotionalExpression = {};
      // 只在该情绪尚未记录时写入（首次坍缩）
      if (!next.emotionalExpression[expr.emotion.trim()]) {
        next.emotionalExpression[expr.emotion.trim()] = expr.expression.trim();
      }
    }
  }

  // Handle vulnerabilityTopics (延迟坍缩：信任高时动态生成)
  if (memoryUpdate.vulnerabilityTopicsAdd && typeof memoryUpdate.vulnerabilityTopicsAdd === 'object') {
    const vuln = memoryUpdate.vulnerabilityTopicsAdd;
    if (vuln.topic && typeof vuln.topic === 'string' && vuln.topic.trim()) {
      if (!Array.isArray(next.vulnerabilityTopics)) next.vulnerabilityTopics = [];
      // 去重（按 topic 名）
      const existing = new Set(next.vulnerabilityTopics.map(v => v.topic));
      if (!existing.has(vuln.topic.trim())) {
        next.vulnerabilityTopics.push({
          topic: vuln.topic.trim(),
          description: (vuln.description || '').trim(),
          timestamp: nowIso()
        });
      }
    }
  }

  return next;
}

function storeLastTurnTts(state, turnOutput) {
  const next = repairState(state);
  next.runtimeCache.lastTurnTts = {
    visibleText: turnOutput.visibleText || '',
    currentEmotion: turnOutput.currentEmotion || '',
    sendVoiceNow: !!turnOutput.sendVoiceNow,
    sendImageNow: !!turnOutput.sendImageNow,
    sendGifNow: !!turnOutput.sendGifNow,
    gifKeyword: turnOutput.gifKeyword || '',
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
  // 三段式调制：raw_Δ × L2系数 × mood系数
  next.dynamicState = applyStateDelta(
    next.dynamicState,
    turnOutput.stateDelta || {},
    next.personalitySettings,
    next.stress
  );
  // Stress 更新
  if (turnOutput.stressDelta) {
    next.stress = applyStressDelta(next.stress, turnOutput.stressDelta, next.personalitySettings);
  }
  // Stress 自然衰减
  next.stress = decayStress(next.stress, next.personalitySettings);
  next.shortTermState = applyShortTermUpdate(next.shortTermState, turnOutput.shortTermUpdate || {});
  next.revealedMemory = mergeMemoryUpdate(next.revealedMemory, turnOutput.memoryUpdate || {});
  next = storeLastTurnTts(next, turnOutput);
  next = incrementTurnCount(next);

  // Push currentEmotion to emotionHistory
  if (turnOutput.currentEmotion) {
    const hist = Array.isArray(next.shortTermState.emotionHistory) ? next.shortTermState.emotionHistory : [];
    hist.push({
      emotion: turnOutput.currentEmotion,
      trigger: turnOutput.shortTermUpdate?.unresolvedEmotion || ''
    });
    next.shortTermState.emotionHistory = hist.slice(-3);
  }

  // Auto-calculate moodFactors.timeOfDay
  if (!next.shortTermState.moodFactors) {
    next.shortTermState.moodFactors = { timeOfDay: '', chatDuration: '', recentEmotionTrend: '' };
  }
  next.shortTermState.moodFactors.timeOfDay = getTimeOfDay();

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
  getTimeOfDay,
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
  updateSessionStartTime,
  ENUM_TO_INT,
  enumToInt,
  getL2Factor,
  getMoodFactor,
  decayStress
};
