const VALID_ENUMS = ['major_decrease', 'minor_decrease', 'neutral', 'minor_increase', 'major_increase'];
const L3_KEYS = ['trust', 'security', 'closeness', 'neediness', 'possessiveness'];

function validateTurnOutput(output) {
  if (!output || typeof output !== 'object') {
    return { ok: false, error: 'Turn output is not an object' };
  }
  const requiredStringFields = ['analysis', 'visibleText'];
  for (const key of requiredStringFields) {
    if (typeof output[key] !== 'string' || !output[key].trim()) {
      return { ok: false, error: `Missing turn field: ${key}` };
    }
  }
  // currentEmotion: optional, default empty
  if (output.currentEmotion === undefined || output.currentEmotion === null) output.currentEmotion = '';
  if (typeof output.sendVoiceNow !== 'boolean') {
    return { ok: false, error: 'sendVoiceNow must be boolean' };
  }

  // sendImageNow is optional, default false
  if (output.sendImageNow !== undefined && typeof output.sendImageNow !== 'boolean') {
    return { ok: false, error: 'sendImageNow must be boolean' };
  }
  if (output.sendImageNow === undefined) {
    output.sendImageNow = false;
  }

  // If sendImageNow is true, imagePrompt must be a non-empty string
  if (output.sendImageNow) {
    if (typeof output.imagePrompt !== 'string' || !output.imagePrompt.trim()) {
      return { ok: false, error: 'imagePrompt must be a non-empty string when sendImageNow is true' };
    }
  }

  // Default imagePrompt and imageCaption if not present
  if (output.imagePrompt === undefined) output.imagePrompt = '';
  if (output.imageCaption === undefined) output.imageCaption = '';

  // imageWaitText, imageFailedText: optional strings
  if (output.imageWaitText === undefined || output.imageWaitText === null) output.imageWaitText = '';
  if (output.imageFailedText === undefined || output.imageFailedText === null) output.imageFailedText = '';

  // useReferencePhoto: optional boolean, default false
  if (output.useReferencePhoto !== undefined && typeof output.useReferencePhoto !== 'boolean') {
    return { ok: false, error: 'useReferencePhoto must be boolean' };
  }
  if (output.useReferencePhoto === undefined) output.useReferencePhoto = false;

  // sendGifNow is optional, default false
  if (output.sendGifNow !== undefined && typeof output.sendGifNow !== 'boolean') {
    return { ok: false, error: 'sendGifNow must be boolean' };
  }
  if (output.sendGifNow === undefined) {
    output.sendGifNow = false;
  }
  // gifKeyword is optional, default ''
  if (output.gifKeyword !== undefined && typeof output.gifKeyword !== 'string') {
    return { ok: false, error: 'gifKeyword must be a string' };
  }
  if (output.gifKeyword === undefined) output.gifKeyword = '';

  // stateDelta: per-field enum validation (discard invalid fields, keep valid ones)
  output.stateDelta = output.stateDelta || {};
  for (const key of L3_KEYS) {
    const val = output.stateDelta[key];
    if (val === undefined || val === null) {
      output.stateDelta[key] = 'neutral';
    } else if (typeof val === 'string') {
      if (!VALID_ENUMS.includes(val)) {
        // Discard invalid field: reset to neutral, don't fail entire output
        output.stateDelta[key] = 'neutral';
      }
    } else if (typeof val === 'number') {
      // backward compat: accept integers, will be handled by enumToInt
    } else {
      output.stateDelta[key] = 'neutral';
    }
  }

  // stressDelta: optional enum value
  if (output.stressDelta !== undefined && output.stressDelta !== null) {
    if (typeof output.stressDelta === 'string' && !VALID_ENUMS.includes(output.stressDelta)) {
      output.stressDelta = 'neutral';
    }
  }
  if (output.stressDelta === undefined) output.stressDelta = 'neutral';

  if (!output.shortTermUpdate || !output.memoryUpdate) {
    return { ok: false, error: 'Missing shortTermUpdate or memoryUpdate' };
  }

  // locationUpdate is optional inside memoryUpdate, null or object
  if (output.memoryUpdate.locationUpdate !== undefined && output.memoryUpdate.locationUpdate !== null) {
    if (typeof output.memoryUpdate.locationUpdate !== 'object') {
      return { ok: false, error: 'memoryUpdate.locationUpdate must be null or object' };
    }
  }
  if (output.memoryUpdate.locationUpdate === undefined) output.memoryUpdate.locationUpdate = null;

  // speechHabitsAdd is optional, null or string
  if (output.memoryUpdate.speechHabitsAdd !== undefined && output.memoryUpdate.speechHabitsAdd !== null) {
    if (typeof output.memoryUpdate.speechHabitsAdd !== 'string') {
      return { ok: false, error: 'memoryUpdate.speechHabitsAdd must be null or string' };
    }
  }
  if (output.memoryUpdate.speechHabitsAdd === undefined) output.memoryUpdate.speechHabitsAdd = null;

  // quirksAdd is optional, null or string
  if (output.memoryUpdate.quirksAdd !== undefined && output.memoryUpdate.quirksAdd !== null) {
    if (typeof output.memoryUpdate.quirksAdd !== 'string') {
      return { ok: false, error: 'memoryUpdate.quirksAdd must be null or string' };
    }
  }
  if (output.memoryUpdate.quirksAdd === undefined) output.memoryUpdate.quirksAdd = null;

  // characterCardUpdate is optional, default empty
  if (!output.characterCardUpdate || typeof output.characterCardUpdate !== 'object') {
    output.characterCardUpdate = {};
  }
  const ccUpdate = output.characterCardUpdate;
  const ccKVCategories = ['identity', 'physicalTraits', 'personalitySelfDescription', 'preferences', 'innerWorld', 'habits'];
  for (const cat of ccKVCategories) {
    if (!ccUpdate[cat] || typeof ccUpdate[cat] !== 'object' || Array.isArray(ccUpdate[cat])) {
      ccUpdate[cat] = {};
    }
  }
  if (!ccUpdate.memories || typeof ccUpdate.memories !== 'object') {
    ccUpdate.memories = { events: [], milestones: [], gifts: [] };
  }
  for (const type of ['events', 'milestones', 'gifts']) {
    if (!Array.isArray(ccUpdate.memories[type])) ccUpdate.memories[type] = [];
  }
  return { ok: true, value: output };
}

function createFallbackTurnOutput(userMessage) {
  const text = String(userMessage || '').trim();
  let safeText = '刚刚没看到，你说啥？';
  let emotion = '短暂失衡后主动修复';
  if (/想你|在吗|在干嘛/.test(text)) {
    safeText = '在呀。你这样突然来找我，很难不让人多想一点。';
    emotion = '轻轻靠近';
  } else if (/不理我|没理我|没回|冷落/.test(text)) {
    safeText = '你这样说，我会有点委屈的。不是闹，就是会记在心里。';
    emotion = '委屈但收着';
  } else if (/以前|之前|大学|学什么|前任|对象/.test(text)) {
    safeText = '你怎么突然开始查我以前的事了？我可以告诉你一点，但你要认真听。';
    emotion = '带保留地回应';
  } else if (/晚安|睡觉|哄我睡/.test(text)) {
    safeText = '那你先安静一点，我陪你待一会儿，再慢慢去睡。';
    emotion = '温柔靠近';
  }
  return {
    visibleText: safeText,
    currentEmotion: emotion,
    sendVoiceNow: false,
    sendImageNow: false,
    imagePrompt: '',
    imageCaption: '',
    imageWaitText: '',
    imageFailedText: '',
    useReferencePhoto: false,
    sendGifNow: false,
    gifKeyword: '',
    stateDelta: {
      trust: 'neutral',
      security: 'neutral',
      closeness: 'neutral',
      neediness: 'neutral',
      possessiveness: 'neutral'
    },
    stressDelta: 'neutral',
    shortTermUpdate: {
      unresolvedEmotion: 'none',
      emotionTrigger: '',
      interactionTrend: 'steady',
      recentVoicePattern: 'none',
      recentImagePattern: 'none',
      emotionHistory: []
    },
    memoryUpdate: {
      nicknameForUser: null,
      nicknameForSelf: null,
      sharedRoutinesAdd: [],
      revealedFactsAdd: [],
      importantEventsAdd: [],
      lastSummary: '',
      locationUpdate: null,
      emotionalExpressionAdd: null,
      speechHabitsAdd: null,
      quirksAdd: null,
      vulnerabilityTopicsAdd: null
    },
    characterCardUpdate: {
      identity: {},
      physicalTraits: {},
      personalitySelfDescription: {},
      preferences: {},
      innerWorld: {},
      habits: {},
      memories: { events: [], milestones: [], gifts: [] }
    }
  };
}

module.exports = {
  validateTurnOutput,
  createFallbackTurnOutput,
  VALID_ENUMS,
  L3_KEYS
};
