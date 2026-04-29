const { createEmptyState } = require('./cyber-gf-state');

const VALID_ENUMS = ['low', 'medium', 'high'];

// Each array: first element = ideal starting value, remaining = acceptable (minor deviation)
const STARTING_RANGES = {
  relationshipWarmth: ['medium', 'low'],
  safety: ['medium', 'low'],
  trust: ['medium', 'low'],
  approachDesire: ['medium', 'low'],
  vulnerabilityWillingness: ['low', 'medium'],
  voiceEase: ['low', 'medium']
};

const FALLBACK_DYNAMIC_STATE_INIT = {
  relationshipWarmth: 'medium',
  safety: 'medium',
  trust: 'medium',
  approachDesire: 'medium',
  vulnerabilityWillingness: 'low',
  voiceEase: 'low'
};

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

  const requiredProfileKeys = ['coreSummary', 'relationshipSummary', 'defenseSummary', 'startSummary', 'voiceSummary', 'appearance', 'profileSummary'];
  for (const key of requiredProfileKeys) {
    if (typeof profile[key] !== 'string' || !profile[key].trim()) {
      return { ok: false, error: `Missing profile field: ${key}` };
    }
  }

  for (const key of ['relationshipWarmth', 'safety', 'trust', 'approachDesire', 'vulnerabilityWillingness', 'voiceEase']) {
    const value = dynamicStateInit[key];
    if (!VALID_ENUMS.includes(value)) {
      return { ok: false, error: `Invalid dynamic state value for ${key}: must be low/medium/high` };
    }
  }

  if (typeof openingMessage !== 'string' || !openingMessage.trim()) {
    return { ok: false, error: 'openingMessage is required' };
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
    if (!VALID_ENUMS.includes(value)) {
      return { status: 'severe', reason: `Invalid enum initial dynamic state for ${key}` };
    }
    if (value === range[0]) continue; // ideal value
    if (range.includes(value)) {
      minor = true; // acceptable but not ideal
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
    next[key] = range[0]; // normalize to ideal starting value
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

function buildInitialState(initialProfileOutput) {
  const base = createEmptyState();
  return {
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
    profile: {
      ...base.profile,
      ...initialProfileOutput.profile
    },
    dynamicState: {
      ...base.dynamicState,
      ...initialProfileOutput.dynamicStateInit
    },
    shortTermState: {
      ...base.shortTermState,
      ...initialProfileOutput.shortTermStateInit
    },
    revealedMemory: {
      ...base.revealedMemory,
      ...initialProfileOutput.revealedMemoryInit
    }
  };
}

module.exports = {
  validateInitialProfile,
  classifyInitialDynamicState,
  normalizeInitialDynamicState,
  resolveInitialProfilePayload,
  STARTING_RANGES,
  FALLBACK_DYNAMIC_STATE_INIT,
  buildInitialState
};
