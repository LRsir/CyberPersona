---
name: cyber-persona
description: "Run CyberPersona (赛博女友) roleplay mode — persistent character on Telegram with voice, image, sticker delivery."
version: 10.4.0
metadata:
  hermes:
    tags: [cyberpersona, roleplay, tts, telegram, voice, image, sticker]
    related_skills: [hermes-agent, image-api, mimo-v2-5-tts, mood-sticker]
---

# CyberPersona Agent Workflow

**Project:** `~/.hermes/CyberPersona-hermes`
**Core principle:** 没有提及就是无限可能性，一旦提及则立刻限定。系统不创造角色，角色通过对话创造自己。

**Load when:** user says `开始赛博女友`, sends messages in CyberPersona mode, or asks about CyberPersona.

## Commands

| Trigger | Action |
|---------|--------|
| `开始赛博女友` | Start — restore state or generate profile |
| `开始赛博女友 cheat on` | Start + enable cheat mode |
| `退出赛博女友` | Exit — save session summary + state |
| `我们分手吧` | Breakup — clear all state and memory |
| `cheat on` / `cheat off` | Toggle cheat mode (info display) |
| `debug on` / `debug off` | Toggle debug mode |
| `debug 状态` / `debug 记忆` | View state / memory (debug mode only) |
| `debug 设置 <dim> <val>` | Modify dimension (debug mode only) |
| `debug 场景 <name>` | Simulate scenario (debug mode only) |

## Turn Flow (每轮对话)

```
build-turn-prompt → LLM推理 → apply-turn-result → 多模态投递
```

### Step 1: Build prompt

```bash
cd ~/.hermes/CyberPersona-hermes
node scripts/build-turn-prompt.js "用户消息"
```

Outputs: prompt file path + context summary.

### Step 2: LLM inference

Use the prompt file from Step 1. Save LLM output to `/tmp/cyber-gf-turn-result.json`.

### Step 3: Apply result

```bash
node scripts/apply-turn-result.js
```

Outputs: `visibleText`, `sendVoiceNow`, `sendImageNow`, `sendGifNow`, `imageWaitText`, `imageFailedText`, etc. State changes are applied automatically.

### Step 4: Deliver (agent executes)

**sendVoiceNow=true：**
```
① send_message(MEDIA:.ogg)             ← visibleText 生成的语音
② if sendImageNow:
     send_message(文字: imageWaitText)  ← 过渡台词（纯文字）
③ delegate_task → 生图 → send_message(MEDIA:image)
```
最终回复留空，不输出 visibleText。

**sendVoiceNow=false：**
```
① 最终回复输出 visibleText（不用 send_message）
② if sendImageNow:
     send_message(文字: imageWaitText)  ← 过渡台词（纯文字）
③ delegate_task → 生图 → send_message(MEDIA:image)
```

**if sendGifNow：** send_message(MEDIA:sticker)

**⚠️ sendVoiceNow=true 时，最终回复必须留空。语音替代文字。**

## First-Time Init (no state file)

```bash
cd ~/.hermes/CyberPersona-hermes && node scripts/init-cyber-persona.js
```

Then parallel:
1. **证件照**: `python3 ~/.hermes/skills/image-api/scripts/image_api.py --json --size 1024x1536 --quality low --format png --moderation low "<appearance tags from seed>"`
2. **语音样本**: mimo-tts voicedesign (voiceStyle + openingMessage from seed)

Send to user: 证件照 → 语音样本 → 开场白。Then show profile summary.

## Exit Flow

```bash
# 1. Save session summary
node src/controller.js apply-session-summary '{"summary":"摘要","keyEvents":[],"emotionalTone":""}'

# 2. Exit
node src/controller.js 退出赛博女友
```

Remove `~/.hermes/.suppress_gateway_notify` flag file on exit.

## Cheat Mode

Default off. Toggle with `cheat on`/`cheat off` or start with `开始赛博女友 cheat on`.

**Cheat ON:** Show round summaries (state changes, emotion shifts, suggestions) + detailed exit summary.
**Cheat OFF:** Only deliver character responses. Start: `<name> 已上线 💕`. Exit: `已退出赛博女友模式 💕`.

## TurnResultPayload (LLM output format)

```json
{
  "visibleText": "角色回复文字",
  "currentEmotion": "当前情绪",
  "sendVoiceNow": false,
  "sendImageNow": false,
  "imagePrompt": "生图prompt",
  "imageWaitText": "生图过渡台词",
  "imageFailedText": "生图失败找补台词",
  "useReferencePhoto": false,
  "sendGifNow": false,
  "gifKeyword": "贴纸关键词",
  "reasoning": "CoT推理（必填，先于delta选择）",
  "stateDelta": {
    "trust": "neutral",
    "security": "minor_increase",
    "closeness": "major_increase",
    "neediness": "minor_increase",
    "possessiveness": "neutral"
  },
  "stressDelta": "minor_decrease",
  "shortTermUpdate": {
    "unresolvedEmotion": "",
    "emotionTrigger": "",
    "interactionTrend": "",
    "recentVoicePattern": "",
    "recentImagePattern": ""
  },
  "memoryUpdate": {
    "nicknameForUser": null,
    "nicknameForSelf": null,
    "sharedRoutinesAdd": [],
    "revealedFactsAdd": [],
    "importantEventsAdd": [],
    "emotionalMemoriesAdd": [],
    "lastSummary": ""
  },
  "__userMessage": "原始用户消息"
}
```

**stateDelta/stressDelta enum values:** `major_decrease` | `minor_decrease` | `neutral` | `minor_increase` | `major_increase`

## Delivery Details

### TTS (语音)
- **日常**: `mimo_tts_voiceclone.py --voice-file data/voice-sample.wav`
- **唱歌**: `mimo_tts.py --voice "茉莉"` (clone 不支持唱歌)
- **超时**: 60s，超时降级纯文本
- 参考 mimo-v2-5-tts skill

### Image (图片)
- `useReferencePhoto=true` → image-api edit 模式
- `useReferencePhoto=false` → image-api generate 模式
- 参数：`--quality low --format png --moderation low`
- 参考 image-api skill，timeout ≥ 180s

### Sticker (贴纸)
```bash
STICKER_URL=$(curl -s -m 5 "https://api.tangdouz.com/a/biaoq.php?return=json&nr=$(python3 -c 'import urllib.parse; print(urllib.parse.quote("gifKeyword"))')" | python3 -c "import json,sys,random; data=json.load(sys.stdin); print(random.choice(data)['thumbSrc'])")
curl -sL "$STICKER_URL" -o /tmp/cyber-gf-sticker.jpg
```

## Pitfalls

1. **sendVoiceNow=true 时不发文字** — 语音替代文字，不要两边都发
2. **reasoning 必填** — LLM 必须先写 CoT 再选 delta，否则校验拒绝
3. **stateDelta 只接受 enum 字符串** — 不接受整数
4. **stress 不属于 L3** — 独立短期状态，不放 dynamicState
5. **setting 类 revealedFacts 不可变** — 一旦坍缩不能修改
6. **时区: Asia/Shanghai** — 不管服务器在哪，时间感知跟用户走
7. **上下文 10 条** — recentContext 最近 10 条消息，不要截断到 3
8. **context compaction 后重新进入** — 发 `开始赛博女友`
9. **imageWaitText 和 visibleText 不拼接** — 各自独立功能
10. **gamification 没有 state 对象** — 用 `loadState()` + `applyStateDelta()` + `saveState()`

## Dependency Skills

- **mimo-v2-5-tts**: 语音合成，需要 `MIMO_API_KEY`
- **image-api**: 图片生成/编辑，需要 `IMAGE_API_KEY` + `IMAGE_API_BASE`
- **mood-sticker**: 表情包搜索，免 API key
