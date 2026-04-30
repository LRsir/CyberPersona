function validateTurnOutput(output) {
  if (!output || typeof output !== 'object') {
    return { ok: false, error: 'Turn output is not an object' };
  }
  const requiredStringFields = ['visibleText', 'currentEmotion'];
  for (const key of requiredStringFields) {
    if (typeof output[key] !== 'string' || !output[key].trim()) {
      return { ok: false, error: `Missing turn field: ${key}` };
    }
  }
  if (typeof output.sendVoiceNow !== 'boolean') {
    return { ok: false, error: 'sendVoiceNow must be boolean' };
  }

  // sendImageNow is optional, default false
  if (output.sendImageNow !== undefined && typeof output.sendImageNow !== 'boolean') {
    return { ok: false, error: 'sendImageNow must be boolean' };
  }
  // Default sendImageNow to false if not present
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

  const stateDeltaKeys = ['trust', 'security', 'intimacy', 'attachment', 'jealousy', 'voiceTendency'];
  const delta = output.stateDelta || {};
  for (const key of stateDeltaKeys) {
    if (delta[key] !== undefined && !Number.isInteger(delta[key])) {
      return { ok: false, error: `stateDelta.${key} must be an integer` };
    }
  }
  // Default missing delta keys to 0
  output.stateDelta = output.stateDelta || {};
  for (const key of stateDeltaKeys) {
    if (output.stateDelta[key] === undefined) output.stateDelta[key] = 0;
  }

  if (!output.shortTermUpdate || !output.memoryUpdate) {
    return { ok: false, error: 'Missing shortTermUpdate or memoryUpdate' };
  }

  return { ok: true, value: output };
}

function createFallbackTurnOutput(userMessage) {
  const text = String(userMessage || '').trim();
  let safeText = '我在呢，刚刚有点卡住了……你再跟我说一句，我这次认真接住你。';
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
    sendGifNow: false,
    gifKeyword: '',
    stateDelta: {
      trust: 0,
      security: 0,
      intimacy: 0,
      attachment: 0,
      jealousy: 0,
      voiceTendency: 0
    },
    shortTermUpdate: {
      unresolvedEmotion: 'none',
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
      lastSummary: ''
    }
  };
}

module.exports = {
  validateTurnOutput,
  createFallbackTurnOutput
};
