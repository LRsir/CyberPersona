---
name: cyber-persona
description: "Run CyberPersona (赛博女友) roleplay mode — start/stop sessions, generate turn-based character responses with TTS voice, image, and sticker delivery on Telegram. Covers the full agent workflow: state management, turn payloads, character response generation with emotion depth system, OGG voice bubble delivery, image generation (selfies/life photos), sticker/meme delivery, gamification, and tool_progress toggling. TTS uses mimo-v2-5-tts skill directly (voice design→clone workflow for character voice consistency)."
version: 8.0.0
metadata:
  hermes:
    tags: [cyberpersona, roleplay, tts, telegram, voice, image, gamification, emotion, sticker]
    related_skills: [hermes-agent, image-api, mimo-v2-5-tts, mood-sticker]
---

# CyberPersona (赛博女友) Agent Workflow

CyberPersona is a character roleplay system at `~/.hermes/CyberPersona-hermes`. The agent generates structured `TurnResultPayload` JSON responses as a persistent character, applies state changes, generates TTS audio, and delivers voice messages as native Telegram voice bubbles.

**v8.0 Major Changes (2026-04-30):**
- Dynamic state: 6 integer dimensions (0-100) replacing old low/medium/high system
- Emotion depth: emotionHistory, emotionalProfile, emotionalMemories, moodFactors
- Memory: sessionSummaries (cross-session memory, last 5 sessions)
- TurnResultPayload: removed `taggedTtsText`/`naturalStylePrompt`, added `sendGifNow`/`gifKeyword`
- Sticker/meme delivery via mood-sticker skill (tangdouz API)
- Prompts fully rewritten for context-driven reasoning (not rule engine)

**History:** Originally at ~/CyberPersona, relocated to ~/.hermes/CyberPersona-hermes (2026-04-29). Cleaned up (2026-04-29): removed 9 unused modules, retained 10 core modules. Major refactor (2026-04-30): emotion/dimension system overhaul across 7 files. Image refactor (2026-04-30): deprecated cyber-gf-image.js, cyber-gf-tts.js, cyber-gf-image-optimizer.js; agent now calls image-api and mimo-tts Python scripts directly. Final: 7 JS modules.

**Load this skill when:** user says `开始赛博女友`, sends messages in CyberPersona mode, or asks about the CyberPersona system.

## Quick Reference

| Action | Command |
|--------|---------|
| Start | `开始赛博女友` → run controller → restore state or generate profile |
| Start (cheat) | `开始赛博女友 cheat on` → 启动并开启 cheat 模式 |
| Exit | `退出赛博女友` → save session summary → save state → disable mode |
| Breakup | `我们分手吧` → clear all state and memory |
| Status | `node cyber-gf-controller.js status` (includes gamification + image stats) |
| Save session summary | `node cyber-gf-controller.js apply-session-summary <json>` |
| Regen reference photo | ~~`node cyber-gf-controller.js generate-reference-photo`~~ DEPRECATED — call `python3 ~/.hermes/skills/image-api/scripts/image_api.py --json ...` directly |

### Cheat Commands

| Action | Command |
|--------|---------|
| Cheat on | `cheat on` → 开启信息展示（回合小结、聊天建议等） |
| Cheat off | `cheat off` → 关闭信息展示，恢复沉浸模式 |

### Debug Commands

| Action | Command |
|--------|---------|
| Debug on | `debug on` → 开启 debug 模式（debug 命令可用） |
| Debug off | `debug off` → 关闭 debug 模式（debug 命令不可用） |
| 状态查看 | `debug 状态` → 展示当前内部状态（维度、情绪、记忆、游戏化） |
| 记忆查看 | `debug 记忆` → 展示所有记忆内容 |
| 状态修改 | `debug 设置 <维度> <值>` → 修改指定维度（如 `debug 设置 trust 80`） |
| 场景模拟 | `debug 场景 <场景名>` → 模拟特定场景测试角色反应 |
| 发语音 | `debug 发语音 <内容>` → 生成语音 + 显示参数 |
| 发照片 | `debug 发照片` → 生成图片 + 显示 prompt |
| 发表情 | `debug 发表情 <关键词>` → 搜索贴纸 + 显示参数 |
| 唱歌 | `debug 唱歌` → 强制语音 + 唱歌模式 |

## Dynamic State — 6 Integer Dimensions (0-100)

Replaced the old low/medium/high system with integer-based dimensions:

| Dimension | Key | Start | Meaning |
|-----------|-----|-------|---------|
| 信任感 | `trust` | 30 | 觉得你靠不靠谱 |
| 安全感 | `security` | 30 | 觉得不会被抛弃 |
| 亲密感 | `intimacy` | 20 | 情感亲近程度 |
| 依恋度 | `attachment` | 20 | 多想和你待一起 |
| 占有欲 | `jealousy` | 10 | 对你和别人的敏感度 |
| 语音倾向度 | `voiceTendency` | 10 | 愿不愿意发语音 |

**Level labels:** 0-20 冰点, 21-40 低, 41-60 中, 61-80 高, 81-100 满

**stateDelta uses integers:** Each turn can adjust dimensions by integer amounts:
- 小事: ±1~5
- 中等事件: ±5~15
- 重大事件: ±15~30
- 极端事件: ±30~50

LLM decides the amount per scene — no hard-coded rules, prompt guidance only.

## Emotion Depth System

### emotionHistory (shortTermState)
Last 3 turns of emotion + trigger. LLM sees this for emotional continuity:
```json
{"emotion": "害羞", "trigger": "被夸好看"}
```

### emotionalProfile (profile)
Generated at character creation by LLM. Contains:
- `baseline`: character's natural emotional expression style
- `vulnerabilityTopics`: deep topics not shared until trust is high
```json
{"baseline": "热情外向、表达直接", "vulnerabilityTopics": [{"topic": "童年经历", "description": "..."}]}
```

### emotionalMemories (revealedMemory)
Long-term emotional memories. Added via `memoryUpdate.emotionalMemoriesAdd`:
```json
{"event": "他说喜欢我穿红裙子", "emotion": "开心", "significance": "高"}
```

### moodFactors (shortTermState)
Auto-calculated background mood factors:
- `timeOfDay`: based on current hour
- `chatDuration`: session length
- `recentEmotionTrend`: from emotionHistory

## Debug 模式

Debug 模式控制调试命令的可用性。默认关闭。

**开关命令：**
- `debug on` — 开启 debug 模式（debug 命令可用）
- `debug off` — 关闭 debug 模式（debug 命令不可用，提示需要开启）

**重置：**
- 退出赛博女友后自动重置为关闭状态

**状态存储：**
- 使用临时文件 `~/.hermes/CyberPersona-hermes/.data/debug-mode.flag` 记录状态
- 存在 = 开启，不存在 = 关闭

### Debug 命令列表

#### debug 状态
展示当前完整的内部状态：
```
📊 Debug 状态

【动态状态】
信任感: 48 (低)  ████████░░ 48/100
安全感: 35 (低)  ███████░░░ 35/100
亲密感: 40 (低)  ████████░░ 40/100
依恋度: 19 (冰点) ████░░░░░░ 19/100
占有欲: 5 (冰点)  █░░░░░░░░░ 5/100
语音倾向度: 18 (冰点) ████░░░░░░ 18/100

【情绪状态】
当前情绪: <currentEmotion>
未解心结: <unresolvedEmotion>
互动趋势: <interactionTrend>

【情绪历史】
1. <emotion> ← <trigger>
2. <emotion> ← <trigger>
3. <emotion> ← <trigger>

【记忆】
已揭示事实: X 条
情绪记忆: X 条
共享日常: X 条
重要事件: X 条

【游戏化】
好感度: X (<等级>)
成就: X/18
今日任务: X/6
```

数据来源：`.cyber-gf-state.json` + gamification 状态

#### debug 记忆
查看当前所有记忆内容：
```
🧠 Debug 记忆

【已揭示事实】
- <fact1>
- <fact2>

【情绪记忆】
1. <event> (<emotion>)
2. <event> (<emotion>)

【重要事件】
- <event>

【共享日常】
- <routine>

【Session 摘要】
<最近的 sessionSummaries>
```

数据来源：`revealedMemory` 中的各字段

#### debug 设置 <维度> <值>
快速调整状态，测试不同关系阶段：
```
debug 设置 trust 80      → 信任感设为80
debug 设置 intimacy 60   → 亲密感设为60
debug 设置 all 50        → 所有维度设为50
```

维度名称：trust, security, intimacy, attachment, jealousy, voiceTendency
值范围：0-100

实现：直接修改 `.cyber-gf-state.json` 中的 `dynamicState` 字段

#### debug 场景 <场景名>
模拟特定场景，测试角色反应：
```
debug 场景 被夸奖       → 模拟被真诚夸奖
debug 场景 吵架         → 模拟发生小冲突
debug 场景 长时间未聊   → 模拟3天没聊天
debug 场景 表白         → 模拟用户表白
debug 场景 吃醋         → 模拟用户提到其他女生
```

实现：构造一个模拟的用户消息，走正常的 turn 流程

#### debug 发语音 <内容>
生成语音并显示参数：
```
debug 发语音 晚安，早点休息
```
→ 生成语音
→ 发送语音
→ 显示：
```
🎤 Debug 语音

文本: 晚安，早点休息
模式: 克隆模式
语音样本: voice-sample.wav
输出: /tmp/cyber-gf-voice.ogg
```

#### debug 发照片
生成图片并显示 prompt：
```
debug 发照片
```
→ 生成图片
→ 发送图片
→ 显示：
```
📷 Debug 图片

Prompt: <实际使用的完整 prompt>
模式: edit（参考照片编辑）
参考照片: <path>
输出: <path>
```

#### debug 发表情 <关键词>
搜索贴纸并显示参数：
```
debug 发表情 害羞
```
→ 搜索并发送贴纸
→ 显示：
```
😄 Debug 贴纸

关键词: 害羞
来源: tangdouz API
URL: <url>
```

#### debug 唱歌
强制唱歌模式：
```
debug 唱歌
```
→ 使用预设音色（茉莉）+ 唱歌标签
→ 生成并发送语音
→ 显示参数

## Full Turn Cycle

### 1. Start CyberPersona

```bash
cd ~/.hermes/CyberPersona-hermes && node cyber-gf-controller.js 开始赛博女友
```

- If state exists → restores, returns profileSummary + lastSummary
- If no state → returns `need_profile_generation` with prompt for `InitialStatePayload`

When entering: **automatically suppress gateway notifications** via flag file `~/.hermes/.suppress_gateway_notify`. Removed on exit/breakup.

> **Note:** tool_progress 由用户手动控制，不自动切换。

### 1b. First-Time Profile Generation (no state file)

When there's no existing state, the agent must:

**第一步：生成完整人设信息（LLM 推理）**

1. Generate `InitialStatePayload` JSON using the prompt from step 1. Must include ALL of these sections (validator rejects if any missing):
   - `profile` — object with REQUIRED keys: `coreSummary`, `relationshipSummary`, `defenseSummary`, `startSummary`, `voiceSummary`, `appearance`, `voiceDescription`, `profileSummary`
   - `dynamicStateInit` — 6 integer values (0-100): trust, security, intimacy, attachment, jealousy, voiceTendency
   - `shortTermStateInit` — object (can be empty `{}`)
   - `revealedMemoryInit` — object (can be empty `{}`)
   - `openingMessage` — string, character's first message to user
   - `emotionalProfile` — { baseline, vulnerabilityTopics } (optional but recommended)
2. Save to `/tmp/cyber-gf-init-payload.json`

**第二步：并行生成三个产物**

并行执行以下三个任务（使用 delegate_task 或同时启动）：

**2.1 输出人物信息卡片**
- 根据 profile 内容，输出角色信息卡片（格式见下方）

**2.2 生成样本声音**
```bash
source ~/.hermes/.env && export MIMO_API_KEY="$MIMO_API_KEY" && export MIMO_BASE_URL="$MIMO_BASE_URL"
```
> **PITFALL:** Ensure `MIMO_API_KEY` and `MIMO_BASE_URL` are set in your .env file.

```bash
python3 ~/.hermes/skills/mimo-v2-5-tts/scripts/mimo_tts_voicedesign.py \
  --context "<voiceDescription from profile>" \
  --text "你好呀，今天天气真不错，我们出去走走吧。" \
  --output ~/.hermes/CyberPersona-hermes/.data/voice-sample.wav
```

**2.3 生成证件照**
```bash
source ~/.hermes/.env && export IMAGE_API_KEY="$IMAGE_API_KEY" && export IMAGE_API_BASE="$IMAGE_API_BASE"
```
> **PITFALL:** Ensure `IMAGE_API_KEY` and `IMAGE_API_BASE` are set in your .env file.

```bash
python3 ~/.hermes/skills/image-api/scripts/image_api.py \
  --json --size 1024x1024 --quality high --format png --moderation low \
  "standard portrait photo, head and shoulders, neutral gray background, looking at camera. <appearance description>"
```
> **NOTE:** `generate-reference-photo` CLI command is deprecated — it prints a message telling you to call image-api directly.
> **PITFALL:** Image API can timeout (120s+) or fail intermittently. Use timeout >= 180s. If it fails, retry with a shorter prompt.

**第三步：应用 start payload**

1. **Add voiceSamplePath to payload** (critical — payload must include the sample path before applying):
```bash
cd ~/.hermes/CyberPersona-hermes && node -e "
const fs = require('fs');
const payload = JSON.parse(fs.readFileSync('/tmp/cyber-gf-init-payload.json', 'utf8'));
payload.profile.voiceSamplePath = '/root/.hermes/CyberPersona-hermes/.data/voice-sample.wav';
fs.writeFileSync('/tmp/cyber-gf-init-payload.json', JSON.stringify(payload, null, 2));
console.log('voiceSamplePath added');
"
```

2. **Apply start payload** (profile saved with voiceSamplePath):
```bash
cd ~/.hermes/CyberPersona-hermes && node cyber-gf-controller.js apply-start-payload /tmp/cyber-gf-init-payload.json
```

**第四步：输出角色介绍**

Send in order:
- **Character info card** (format below)
- **Character photo**: reference photo from step 2.3
- **Character voice**: voice sample from step 2.2
- **Opening message**: character's first message

**Character info card format (v8.0):**
```
💗 新角色已生成

【基本信息】
姓名：<name>
年龄：<age>
性格：<personality summary>

【外貌】
<appearance description>

【声音】
<voice description>

【情绪特质】
<emotionalProfile.baseline>

【关系状态】
好感度: 0 (陌生 😐)
信任感: 30 (低)
安全感: 30 (低)
亲密感: 20 (冰点)
依恋度: 20 (冰点)
占有欲: 10 (冰点)
语音倾向度: 10 (冰点)

【游戏化】
成就: 0/18
今日任务: 0/6
```

### 2. User Sends a Message → Generate Turn

**Step A: Get turn context payload**
```bash
cd ~/.hermes/CyberPersona-hermes && node cyber-gf-controller.js turn-payload "<user message>"
```
Returns: full context JSON with all fields including NEW v8.0 fields:
- `profile` — character info + `emotionalProfile`, `sessionSummaries`
- `dynamicState` — 6 integer dimensions
- `shortTermState` — + `emotionHistory`, `moodFactors`
- `revealedMemory` — + `emotionalMemories`
- `recentContext`, `userMessage`

**Step B: Generate TurnResultPayload as the character**

Using the context from Step A, generate a JSON response. The output structure (v8.0):
```json
{
  "visibleText": "",
  "currentEmotion": "",
  "sendVoiceNow": false,
  "sendImageNow": false,
  "imagePrompt": "",
  "imageCaption": "",
  "sendGifNow": false,
  "gifKeyword": "",
  "stateDelta": {
    "trust": 0,
    "security": 0,
    "intimacy": 0,
    "attachment": 0,
    "jealousy": 0,
    "voiceTendency": 0
  },
  "shortTermUpdate": {
    "unresolvedEmotion": "",
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
  "__userMessage": ""
}
```

**Key changes from v7.0:**
- ❌ `taggedTtsText` — REMOVED (TTS text = visibleText)
- ❌ `naturalStylePrompt` — REMOVED (style in --context param)
- ✅ `sendGifNow` — boolean, whether to send a sticker/meme this turn
- ✅ `gifKeyword` — Chinese keyword for sticker search (e.g. "害羞", "开心")
- ✅ `stateDelta` — now integer values, not slight_up/slight_down/keep
- ✅ `emotionalMemoriesAdd` — in memoryUpdate

**Sticker/meme delivery:**
When `sendGifNow=true`, agent searches sticker API:
```bash
curl -s -m 5 "https://api.tangdouz.com/a/biaoq.php?return=json&nr=<gifKeyword>"
```
Pick random result's `thumbSrc` URL, send via `send_message`.

**Image guidelines:**
- Don't send images every turn — 3-5 turns between images
- `imagePrompt` must be English, include `profile.appearance` for consistency
- Reference photo edit API preferred for character consistency

Save to `/tmp/cyber-gf-turn-result.json` then apply.

**Step C: Apply turn result**
```bash
cd ~/.hermes/CyberPersona-hermes && node cyber-gf-controller.js apply-turn-payload "$(cat /tmp/cyber-gf-turn-result.json)"
```

**Step D: Generate TTS + send voice (if sendVoiceNow=true)**

Agent calls mimo-tts skill scripts directly. TTS text = `visibleText`:

**日常语音（clone 模式）：**
```bash
source /root/.hermes/.env && export MIMO_API_KEY="***" && export MIMO_BASE_URL="$XIAOMI_BASE_URL"
python3 ~/.hermes/skills/mimo-v2-5-tts/scripts/mimo_tts_voiceclone.py \
  --voice-file ~/.hermes/CyberPersona-hermes/.data/voice-sample.wav \
  --context "自然语言风格控制" \
  --text "visibleText的内容" \
  --output /tmp/cyber-gf-tts-output.wav
ffmpeg -y -i /tmp/cyber-gf-tts-output.wav -c:a libopus -b:a 32k /tmp/cyber-gf-tts-output.ogg
```

**唱歌（preset 模式，clone 不支持唱歌）：**
```bash
source /root/.hermes/.env && export MIMO_API_KEY="***" && export MIMO_BASE_URL="$XIAOMI_BASE_URL"
python3 ~/.hermes/skills/mimo-v2-5-tts/scripts/mimo_tts.py \
  --voice "茉莉" \
  --text "(唱歌)完整歌词内容" \
  --output /tmp/cyber-gf-tts-output.wav
ffmpeg -y -i /tmp/cyber-gf-tts-output.wav -c:a libopus -b:a 32k /tmp/cyber-gf-tts-output.ogg
```

Then send as Telegram voice bubble:
```
send_message(message="MEDIA:/tmp/cyber-gf-tts-output.ogg", target="telegram")
```

**Step E: Send sticker (if sendGifNow=true)**
```bash
STICKER_URL=$(curl -s -m 5 "https://api.tangdouz.com/a/biaoq.php?return=json&nr=$(python3 -c 'import urllib.parse; print(urllib.parse.quote("gifKeyword的值"))')" | python3 -c "import json,sys,random; data=json.load(sys.stdin); print(random.choice(data)['thumbSrc'])")
curl -sL "$STICKER_URL" -o /tmp/cyber-gf-sticker.jpg
send_message(message="MEDIA:/tmp/cyber-gf-sticker.jpg", target="telegram")
```

**Step F: Send image (if sendImageNow=true)**

Check state for generated image, then send via Telegram.

If both sendVoiceNow and sendImageNow are true, send voice first, then sticker, then image.

**沉浸感规则：当 sendVoiceNow=true 时，只发送语音，不要重复发送 visibleText 的文字消息。** 语音本身就是角色的表达，文字会破坏沉浸感。只有当 sendVoiceNow=false 时才发送文字消息。

### 3. Exit CyberPersona

**Before exit, generate session summary:**
```bash
cd ~/.hermes/CyberPersona-hermes && node cyber-gf-controller.js apply-session-summary '{"summary":"对话摘要","keyEvents":["事件1"],"emotionalTone":"温馨"}'
```

Then exit:
```bash
cd ~/.hermes/CyberPersona-hermes && node cyber-gf-controller.js 退出赛博女友
```

When exiting: **remove gateway notification suppression flag**.

> **Note:** tool_progress 由用户手动控制，退出时不需要自动恢复。

## Modules (7 — all integrated)

| Module | File | Integration Point |
|--------|------|-------------------|
| Config | `cyber-gf-config.js` | Configuration loading |
| State | `cyber-gf-state.js` | State CRUD + runtime counters + emotionHistory + moodFactors |
| Profile | `cyber-gf-profile.js` | Initial profile validation (integer dimensions) |
| Turn | `cyber-gf-turn.js` | Turn output validation (integer deltas, sendGifNow) |
| Prompts | `cyber-gf-prompts.js` | LLM prompt construction (v8.0 full rewrite) |
| Gamification | `cyber-gf-gamification.js` | Achievements, affection, daily tasks, collections |
| Controller | `cyber-gf-controller.js` | Main orchestrator, CLI, delivery |

## Gamification System

**Achievements (18):** first_conversation, ten_conversations, hundred_conversations, first_voice, voice_master, first_selfie, photo_collector, first_heartbeat, trust_fall, soulmate, one_week, one_month, one_year, night_owl, early_bird, all_night, nickname_collector, memory_keeper

**Achievement conditions updated (v8.0):** now use integer thresholds (>= 80) instead of === 'high'

**Affection levels:** 陌生(0-100) → 认识(101-300) → 友好(301-500) → 亲密(501-700) → 心动(701-900) → 恋人(901-1000)

**Daily tasks:** 早安问候, 晚安问候, 分享心情, 语音聊天, 照片分享, 深入对话

## Key Pitfalls

1. **`tts-last` is NOT a valid CLI command** — must use `node -e "require('./cyber-gf-controller').speakLastTurn()"` instead.

2. **Voice delivery must use `send_message` tool**, not inline `MEDIA:` in response text.

3. **TTS uses mimo-v2-5-tts skill** — Agent calls MiMo TTS Python scripts directly. TTS text = `visibleText`.

4. **TTS Architecture — Voice Design→Clone Workflow:**
- **Character creation:** voiceDescription → `mimo_tts_voicedesign.py` → voice sample → `profile.voiceSamplePath`
- **Every voice turn:** `mimo_tts_voiceclone.py --voice-file <sample>` → consistent voice
- **Singing:** Clone does NOT support singing. Fallback: `mimo_tts.py --voice "茉莉" --text "(唱歌)歌词"`
- **Profile fields:** `profile.voiceDescription`, `profile.voiceSamplePath`

5. **State file**: `~/.hermes/CyberPersona-hermes/.cyber-gf-state.json` (project root, NOT `.data/`).

6. **Image generation**: Agent calls image-api skill Python scripts directly (same pattern as mimo-tts). Use: `python3 ~/.hermes/skills/image-api/scripts/image_api.py --json ...`. 15-30s for generate, 60-180s for edits. **Use timeout >= 180s.**

7. **Image API failure modes & retry strategy:**
   - **Timeout (120s+)**: API can hang. Set terminal timeout to 180s. If it times out, check `/tmp/gptimage/` for any partial output.
   - **JSON decode error**: API returns empty/malformed response. Retry with a significantly shorter, simpler prompt.
   - **Edit API "Upstream request failed"**: Edit endpoint can fail independently. Fallback: retry with generate API (no --edit flag).
   - **Retry order**: generate → generate with shorter prompt → edit with reference photo → reuse from `/tmp/gptimage/`.

8. **Gateway notification suppression** — Uses flag file `~/.hermes/.suppress_gateway_notify`.

9. **Singing (唱歌)** — Only with preset voices (`mimo-v2.5-tts`). Voice clone does NOT support singing.

10. **Character appearance consistency** — All images use edit API with reference photo as base.

11. **`handleHybridCommand` is async** — Must `await` when calling programmatically.

12. **State file after exit** — Remains with `mode.enabled=false`. Next `开始赛博女友` triggers `need_profile_generation`.

13. **`debug` 命令格式** — 统一为 `debug <功能> <参数>`，如 `debug 状态`、`debug 设置 trust 80`、`debug 发语音 晚安`。必须先 `debug on` 开启 debug 模式才能使用。

14. **Always verify state before processing a turn** — Check `profile.coreSummary` non-empty and `mode.enabled === true`.

15. **Context compaction can break the runtime loop** — After compaction, re-enter with `开始赛博女友`.

16. **State resets between tool calls (intermittent)** — Before every `turn-payload`, re-apply start payload as recovery anchor.

17. **Fast recovery when state is lost but assets exist** — Voice sample and reference photo survive state corruption. Skip regeneration if they exist.

18. **Sticker API (tangdouz)** — Free, no API key needed. Returns JSON array with `thumbSrc` URLs. Installed as `mood-sticker` skill.

19. **`gamification.state` is undefined in controller scope** — The gamification module exports functions, NOT a `state` object. In controller, `state = gamification.state` silently sets state to `undefined`, causing `saveState(state)` to overwrite the file with empty data. All stateDelta changes from that turn are lost. Fix: use `const state = loadState(); ... applyStateDelta(state, ...); saveState(state);` — never read state from gamification. Always verify `state` is a real object before calling `saveState()`.

20. **After deleting modules, check all cross-references** — When removing JS files (e.g. deprecated wrappers), grep for their `require()` paths and function calls in remaining files. Controller had dangling references to deleted image.js/tts.js that needed cleanup. Run: `grep -rn 'deleted-module-name' *.js` before committing.

## Character Response Guidelines (v8.0)

When generating TurnResultPayload:
- **真实感优先于讨好感** — authentic over pleasing
- **上下文驱动推理，不执行规则** — "这个人+这时候+怎么回复"
- stateDelta uses integers, scene-appropriate magnitudes
- `sendVoiceNow=true` for emotional moments, not every turn
- `sendGifNow=true` for expression reactions (sticker cheaper than generated image)
- `lastSummary` must be a concise relationship snapshot
- Check `revealedFacts` before introducing past facts
- Check `emotionalProfile.vulnerabilityTopics` — don't discuss until trust is high
- Check `emotionHistory` for emotional continuity
- Check `sessionSummaries` for cross-session memory
- **Emotion expression:** 害羞→短句省略号, 开心→感叹号emoji, 低落→长句沉默, 生气→直接反问
- **User emotion perception:** notice user's emotional tone and adjust
- **Occasional interaction:** sometimes initiate small games (猜谜, 联想, 问答)

## Agent Behavior Consistency

**数据来源原则：** 所有小结和总结中的数字、情绪转变必须从系统实际数据读取，不能自由发挥。
- 状态变化：从 `apply-turn-payload` 返回结果或 `.cyber-gf-state.json` 读取
- 情绪转变：从 `emotionHistory` 数组读取
- 好感度/成就：从 gamification 状态读取

### Cheat 模式

Cheat 模式控制三阶段信息展示（回合小结、聊天建议、详细退出总结）的开关。默认关闭。

**开启方式：**
- `开始赛博女友 cheat on` — 开始时就开启
- 对话中输入 `cheat on` — 随时开启

**关闭方式：**
- 对话中输入 `cheat off` — 随时关闭

**重置：**
- 退出赛博女友后自动重置为关闭状态

**状态存储：**
- 使用环境变量或临时文件 `~/.hermes/CyberPersona-hermes/.data/cheat-mode.flag` 记录状态
- 存在 = 开启，不存在 = 关闭

**Cheat 开启时展示的内容：**
- 开始信息：上次回顾 + 当前关系状态
- 回合小结：状态变化 + 情绪转变 + 动态评价 + 聊天建议
- 退出总结：完整详细总结

**Cheat 关闭时：**
- 开始：只显示 `<角色名> 已上线 💕`
- 回合：只发送角色回复（文字/语音/图片/贴纸），不附带任何小结
- 退出：只显示 `已退出赛博女友模式 💕`

### 1. 开始信息（进入模式时）

**Cheat 开启时发送：**
```
赛博女友模式已开启 ✨

<角色名> 已上线 💕

【上次回顾】
<从 profile.sessionSummaries 和 revealedMemory.lastSummary 提取，简述上次对话>

【当前关系状态】
好感度: X (<等级>)
信任感: X (<等级>)
安全感: X (<等级>)
亲密感: X (<等级>)
依恋度: X (<等级>)
占有欲: X (<等级>)
语音倾向度: X (<等级>)
```

**Cheat 关闭时发送：**
```
<角色名> 已上线 💕
```

### 2. 回合小结（每轮对话后）

**Cheat 开启时：** 每轮发送角色回复后，附带小结：
```
📊 回合小结

状态变化： <维度> <变化量>（<旧值>→<新值>），...
情绪转变： <上一轮情绪> → <本轮情绪>（<触发原因>）
动态： <对这轮对话的评价，分析角色回应质量、关系走向>

💡 聊天建议：<基于当前状态的回复方向或话题>
```

- 状态变化：从 stateDelta 和实际状态计算，显示有变化的维度
- 情绪转变：从 emotionHistory 读取最近两条对比
- 动态：agent 自由发挥，评价这轮对话的质量和关系走向
- 聊天建议：基于当前状态给出针对性建议
  - 哪些维度偏低就引导提升哪个
  - 基于当前情绪状态建议互动方式
  - 给出具体可操作的回复方向或话题
  - 用自然的方式表达，不要太破坏沉浸感

**Cheat 关闭时：** 只发送角色回复，不附带任何小结。

### 3. 退出总结（退出模式时）

先执行 `apply-session-summary`，然后根据 cheat 模式发送不同内容。

**Cheat 开启时发送：**
```
✅ 已退出赛博女友模式

【本次 Session】
- 🎭 角色： <名字> — <简介>
- 💬 回合数： X 轮对话
- 📊 关系进展：
  - 信任感 X → X
  - 安全感 X → X
  - 亲密感 X → X
  - 依恋度 X → X
  - 占有欲 X → X
  - 语音倾向度 X → X
- 💗 好感度： X → X（<等级>）
- 🏆 成就： X/18（<已解锁的成就>）

【对话评价】
<对本轮对话的整体评价，类似回合小结的"动态"部分>

【记忆更新】
<session-summary 的保存结果，以及提取的关键记忆>
```

**Cheat 关闭时发送：**
```
已退出赛博女友模式 💕
```

**退出后自动重置：** 删除 cheat-mode.flag 文件

## Dependency Skill Sources

The 3 external skills are NOT built-in to Hermes Agent — each requires separate installation:

- **mimo-v2-5-tts**: [XiaomiMiMo/MiMo-Skills](https://github.com/XiaomiMiMo/MiMo-Skills) — install via `npx skills add XiaomiMiMo/MiMo-Skills` or git clone + symlink. Requires `MIMO_API_KEY`.
- **image-api**: Custom unpublished skill at `~/.hermes/skills/image-api/`. Requires `IMAGE_API_KEY` + `IMAGE_API_BASE`.
- **mood-sticker**: [clawhub.ai/chensanle/sticker](https://clawhub.ai/chensanle/sticker) — Hermes skill bundle install. Free, no API key.
