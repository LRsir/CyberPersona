const { createEmptyState } = require('./cyber-gf-state');

// Integer dimensions validated 0–100
const DIMENSION_MIN = 0;
const DIMENSION_MAX = 100;

// Each array: [ideal, min-acceptable, max-acceptable]
// L3 关系数值（新 5 维）
const STARTING_RANGES = {
  trust:          [30, 5, 70],
  security:       [30, 5, 70],
  closeness:      [15, 0, 50],
  neediness:      [15, 0, 50],
  possessiveness: [10, 0, 50]
};

const FALLBACK_DYNAMIC_STATE_INIT = {
  trust: 30,
  security: 30,
  closeness: 15,
  neediness: 15,
  possessiveness: 10
};

/**
 * 根据 personalitySettings (Big Five) 计算初始关系值
 * 遵循三阶段调制系统的逻辑：人格影响初始状态
 */
function computeInitialDynamicState(personalitySettings) {
  const ps = personalitySettings || {};
  const n = ps.neuroticism ?? 50;
  const a = ps.agreeableness ?? 50;
  const o = ps.openness ?? 50;
  const c = ps.conscientiousness ?? 50;
  const e = ps.extraversion ?? 50;

  // trust: 受 agreeableness + conscientiousness 影响
  // 高 A + 高 C → 更容易信任
  const trust = Math.round(20 + (a * 0.3) + (c * 0.2));
  
  // security: 受 neuroticism 影响（反向）
  // 低 N → 更有安全感
  const security = Math.round(50 - (n * 0.3));
  
  // closeness: 受 extraversion + openness 影响
  // 高 E + 高 O → 更愿意亲近
  const closeness = Math.round(5 + (e * 0.25) + (o * 0.15));
  
  // neediness: 受 neuroticism + (100 - extraversion) 影响
  // 高 N + 低 E → 更需要陪伴
  const neediness = Math.round(10 + (n * 0.2) + ((100 - e) * 0.15));
  
  // possessiveness: 受 neuroticism + (100 - agreeableness) 影响
  // 高 N + 低 A → 更强占有欲
  const possessiveness = Math.round(5 + (n * 0.15) + ((100 - a) * 0.15));

  return {
    trust: clampToRange(trust, 5, 70),
    security: clampToRange(security, 5, 70),
    closeness: clampToRange(closeness, 0, 50),
    neediness: clampToRange(neediness, 0, 50),
    possessiveness: clampToRange(possessiveness, 0, 50)
  };
}

const FALLBACK_STRESS = 20;

const MINOR_MARGIN = 5;

function validateInitialProfile(output) {
  if (!output || typeof output !== 'object') {
    return { ok: false, error: 'Initial profile payload is not an object' };
  }
  const profile = output.profile;
  const dynamicStateInit = output.dynamicStateInit;
  const shortTermStateInit = output.shortTermStateInit;
  const revealedMemoryInit = output.revealedMemoryInit;
  const openingMessage = output.openingMessage;

  if (!profile || !dynamicStateInit || !shortTermStateInit || !revealedMemoryInit) {
    return { ok: false, error: 'Missing required top-level sections' };
  }

  const requiredProfileKeys = ['coreSummary', 'relationshipSummary', 'defenseSummary', 'startSummary', 'voiceSummary', 'appearance', 'voiceDescription', 'profileSummary'];
  for (const key of requiredProfileKeys) {
    if (typeof profile[key] !== 'string' || !profile[key].trim()) {
      return { ok: false, error: `Missing profile field: ${key}` };
    }
  }

  // Validate personalitySettings (L2)
  const ps = output.personalitySettings;
  if (ps) {
    const l2Keys = ['neuroticism', 'agreeableness', 'openness', 'conscientiousness', 'extraversion'];
    for (const key of l2Keys) {
      if (ps[key] !== undefined && (typeof ps[key] !== 'number' || !Number.isInteger(ps[key]) || ps[key] < 0 || ps[key] > 100)) {
        return { ok: false, error: `personalitySettings.${key} must be integer 0-100` };
      }
    }
  }

  const dimensionKeys = Object.keys(STARTING_RANGES);
  for (const key of dimensionKeys) {
    const value = dynamicStateInit[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < DIMENSION_MIN || value > DIMENSION_MAX) {
      return { ok: false, error: `Invalid dynamic state value for ${key}: must be integer ${DIMENSION_MIN}-${DIMENSION_MAX}` };
    }
  }

  // emotionalProfile is optional, but if present must have a baseline string
  if (output.emotionalProfile !== undefined) {
    if (!output.emotionalProfile || typeof output.emotionalProfile.baseline !== 'string' || !output.emotionalProfile.baseline.trim()) {
      return { ok: false, error: 'emotionalProfile.baseline must be a non-empty string when emotionalProfile is provided' };
    }
  }

  if (typeof openingMessage !== 'string' || !openingMessage.trim()) {
    return { ok: false, error: 'openingMessage is required' };
  }

  // Quantum State Enforcement: 初始记忆必须为空，留给后续对话坍缩
  const quantumFields = [
    { key: 'revealedFacts', label: '揭示的事实' },
    { key: 'emotionalMemories', label: '情绪记忆' },
    { key: 'importantEvents', label: '重要事件' },
  ];
  for (const { key, label } of quantumFields) {
    if (revealedMemoryInit[key] && revealedMemoryInit[key].length > 0) {
      return { ok: false, error: `Quantum State Violation: revealedMemoryInit.${key} 必须为空数组！${label}在初始状态下禁止预设，必须在后续对话中自然坍缩。` };
    }
  }

  return { ok: true, value: output };
}

function clampToRange(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(Number(value))));
}

function classifyInitialDynamicState(dynamicStateInit) {
  let minor = false;

  for (const [key, range] of Object.entries(STARTING_RANGES)) {
    const value = dynamicStateInit[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < DIMENSION_MIN || value > DIMENSION_MAX) {
      return { status: 'severe', reason: `Invalid integer initial dynamic state for ${key}` };
    }
    const [ideal, minAccept, maxAccept] = range;
    if (value === ideal) continue;
    if (value >= minAccept && value <= maxAccept) {
      minor = true;
    } else {
      return { status: 'severe', reason: `Initial dynamic state severely out of range for ${key}` };
    }
  }

  if (minor) return { status: 'minor', reason: 'Initial dynamic state slightly out of range' };
  return { status: 'ok', reason: null };
}

function normalizeInitialDynamicState(dynamicStateInit) {
  const next = { ...dynamicStateInit };
  for (const [key, range] of Object.entries(STARTING_RANGES)) {
    const [, minAccept, maxAccept] = range;
    next[key] = clampToRange(next[key], minAccept, maxAccept);
  }
  return next;
}

function applyFallbackInitialDynamicState(payload) {
  return {
    ...payload,
    dynamicStateInit: {
      ...FALLBACK_DYNAMIC_STATE_INIT
    }
  };
}

function resolveInitialProfilePayload(output, options = {}) {
  const attempt = Number(options.attempt || 1);
  const maxAttempts = Number(options.maxAttempts || 3);
  const validated = validateInitialProfile(output);
  if (!validated.ok) {
    return {
      ok: false,
      retryable: true,
      severe: true,
      reason: validated.error
    };
  }

  const payload = validated.value;
  
  // 根据 personalitySettings 计算初始关系值（如果 LLM 没有提供或提供的是默认值）
  if (payload.personalitySettings && payload.dynamicStateInit) {
    const computed = computeInitialDynamicState(payload.personalitySettings);
    // 只有当 LLM 提供的值接近默认理想值时才覆盖（说明 LLM 没有认真推导）
    const isDefault = Math.abs(payload.dynamicStateInit.trust - 30) < 5 && 
                      Math.abs(payload.dynamicStateInit.security - 30) < 5;
    if (isDefault) {
      payload.dynamicStateInit = computed;
    }
  }
  
  const classification = classifyInitialDynamicState(payload.dynamicStateInit);
  if (classification.status === 'ok') {
    return {
      ok: true,
      value: payload,
      resolution: 'as_is'
    };
  }

  if (classification.status === 'minor') {
    return {
      ok: true,
      value: {
        ...payload,
        dynamicStateInit: normalizeInitialDynamicState(payload.dynamicStateInit)
      },
      resolution: 'minor_clamped'
    };
  }

  if (attempt >= maxAttempts) {
    return {
      ok: true,
      value: applyFallbackInitialDynamicState(payload),
      resolution: 'fallback_defaults'
    };
  }

  return {
    ok: false,
    retryable: true,
    severe: true,
    reason: classification.reason
  };
}

/**
 * 构建初始状态（v3 角色卡版本）
 * @param {object} seed - 脚本生成的种子数据（systemBase + appearance + voice + openingStrategy）
 * @param {object} llmOutput - LLM 生成的补充数据（signatureLine + openingMessage + emotionalProfile）
 */
function buildInitialState(seed, llmOutput) {
  const base = createEmptyState();
  const output = llmOutput || {};

  // 从 seed 填充 characterCard
  const characterCard = { ...base.characterCard };
  if (seed) {
    characterCard.systemBase = {
      bigFive: seed.bigFive || base.characterCard.systemBase.bigFive,
      personalityArchetype: seed.personalityArchetype || '',
      openingStrategy: seed.openingStrategy || ''
    };
    characterCard.appearance = {
      ...(seed.appearance || {}),
      bodyType: seed.appearance?.bodyType || ''
    };
    characterCard.voice = {
      voiceStyle: seed.voiceStyle || ''
    };
  }

  // LLM 生成的签名语
  if (output.signatureLine) {
    characterCard.signatureLine = String(output.signatureLine).trim();
  }

  // LLM 生成的证件照路径
  if (output.referencePhotoPath) {
    characterCard.referencePhotoPath = String(output.referencePhotoPath).trim();
  }

  // 从 bigFive 映射 personalitySettings
  const bigFive = characterCard.systemBase.bigFive;
  const personalitySettings = {
    openness: bigFive.o ?? 50,
    conscientiousness: bigFive.c ?? 50,
    extraversion: bigFive.e ?? 50,
    agreeableness: bigFive.a ?? 50,
    neuroticism: bigFive.n ?? 50
  };

  // 计算初始关系值
  const dynamicStateInit = output.dynamicStateInit || computeInitialDynamicState(personalitySettings);

  const state = {
    ...base,
    mode: {
      enabled: true,
      type: 'cyber_girlfriend'
    },
    meta: {
      ...base.meta,
      sessionCount: 1,
      turnCount: 0
    },
    characterCard,
    personalitySettings,
    // 保留旧版 profile 结构（兼容过渡期）
    profile: {
      ...base.profile,
      ...(output.profile || {}),
      appearance: characterCard.appearance ? JSON.stringify(characterCard.appearance) : '',
      referencePhotoPath: characterCard.referencePhotoPath,
      coreSummary: output.profile?.coreSummary || characterCard.systemBase.personalityArchetype
    },
    dynamicState: {
      ...base.dynamicState,
      ...dynamicStateInit
    },
    stress: output.stressInit ?? FALLBACK_STRESS,
    shortTermState: {
      ...base.shortTermState,
      ...(output.shortTermStateInit || {})
    },
    revealedMemory: {
      ...base.revealedMemory,
      ...(output.revealedMemoryInit || {})
    },
    sessionSummaries: []
  };

  // Include emotionalProfile if the LLM provided one
  if (output.emotionalProfile) {
    state.profile.emotionalProfile = output.emotionalProfile;
  }

  return state;
}

module.exports = {
  validateInitialProfile,
  classifyInitialDynamicState,
  normalizeInitialDynamicState,
  resolveInitialProfilePayload,
  computeInitialDynamicState,
  STARTING_RANGES,
  FALLBACK_DYNAMIC_STATE_INIT,
  FALLBACK_STRESS,
  buildInitialState
};
