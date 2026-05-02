---
name: cyber-persona
description: "Run CyberPersona (赛博女友) roleplay mode — quantum-state character generation, Big Five personality, 5-dimension relationship system, stress modulation, enum-based state deltas, three opening strategies, world sync (weather/holidays/time), TTS voice, image, sticker delivery on Telegram."
version: 10.1.0
metadata:
  hermes:
    tags: [cyberpersona, roleplay, tts, telegram, voice, image, gamification, emotion, sticker, quantum-state, big-five]
    related_skills: [hermes-agent, image-api, mimo-v2-5-tts, mood-sticker]
---

# CyberPersona (赛博女友) Agent Workflow

CyberPersona is a character roleplay system at `~/.hermes/CyberPersona-hermes`. The agent generates structured `TurnResultPayload` JSON responses as a persistent character, applies state changes, generates TTS audio, and delivers voice messages as native Telegram voice bubbles.

**v9.3.0 Changes (2026-05-01):**
- **speechHabits 量子态**: 种子不再生成说话习惯，初始为空，首次对话时自然展现并通过 `memoryUpdate.speechHabitsAdd` 记录
- **quirks 量子态**: 种子不再生成小怪癖，初始为空，首次对话时自然展现并通过 `memoryUpdate.quirksAdd` 记录
- **Big Five 排序标准化**: 从 N/A/O/C/E 改为 OCEAN (Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism)
- **关系初始值人格化**: `computeInitialDynamicState()` 根据 personalitySettings 计算初始关系值，不再使用固定理想值
  - trust: 受 agreeableness + conscientiousness 影响
  - security: 受 neuroticism 反向影响
  - closeness: 受 extraversion + openness 影响
  - neediness: 受 neuroticism + (100-extraversion) 影响
  - possessiveness: 受 neuroticism + (100-agreeableness) 影响

**v9.2.0 Changes (2026-05-01):**
- Quantum state code-layer hard enforcement: `validateInitialProfile` rejects non-empty `revealedFacts`/`emotionalMemories`/`importantEvents`; `applyInitialStatePayload` force-clears as double safety
- Timezone fix: `getTimeOfDay()` forces `Asia/Shanghai` via `toLocaleString("en-US", {timeZone: "Asia/Shanghai"})`
- Context window expansion: `recentContext` from 3→10 messages (fixes "fish memory" — character can remember jokes from 5 turns ago)
- State version migration: `createEmptyState()` version 1→2, `repairState()` auto-migrates v1→v2 (removes voiceTendency, renames intimacy→closeness/attachment→neediness/jealousy→possessiveness, ensures personalitySettings+stress)
- **User workflow rule: every code change MUST check CHANGELOG + README + SKILL.md + desensitization scan together**

**Core Philosophy: Quantum State (量子态)**
> 没有提及就是无限可能，一旦提及，则立刻限定。系统不创造角色，角色通过对话创造自己。

**v9.1.0 Major Changes (2026-05-01):**
- Big Five personality (N/A/O/C/E) replaces custom L2 parameters
- 5 L3 dimensions (trust/security/closeness/neediness/possessiveness), voiceTendency removed
- Three-stage modulation: `effective_Δ = raw_Δ_enum × l2_factor × mood_factor`
- Enum-based deltas (major_decrease/minor_increase/...) to prevent LLM hallucination
- Stress system as independent short-term state
- Three opening strategies (emotion/schrodinger/observer), randomly assigned
- revealedFacts type classification (setting immutable, experience revisable)
- World sync: weather (wttr.in), holidays, time awareness (7 periods), location quantum state
- State narrative translation (numeric → natural language)

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

## Four-Layer Architecture

| Layer | Name | Mutability | Description |
|-------|------|------------|-------------|
| L1 | Physical | Immutable | name, age, gender, MBTI, height/weight, appearance |
| L2 | Personality | Slow calibration (±0.1~0.3) | Big Five: neuroticism/agreeableness/openness/conscientiousness/extraversion |
| L3 | Relationship | Dynamic, per-turn | trust/security/closeness/neediness/possessiveness |
| L4 | Memory | Cumulative | revealedFacts/ sessionSummaries/ emotionalMemories |

## L2 — Big Five Personality (0-100)

Generated at character creation. Slowly calibrated each turn (±0.1~0.3).

| Dimension | Key | High | Low |
|-----------|-----|------|-----|
| 神经质 | neuroticism | Emotional, sensitive, anxious | Stable, calm, resilient |
| 宜人性 | agreeableness | Caring, accommodating, empathetic | Independent, blunt, self-protective |
| 开放性 | openness | Curious, imaginative, experimental | Realistic, stable, cautious |
| 尽责性 | conscientiousness | Planned, committed, worrisome | Spontaneous, flexible, easygoing |
| 外向性 | extraversion | Proactive, enthusiastic, talkative | Introverted, quiet, recharging |

**L2 modulation mapping:**
- neuroticism → all dimensions (amplitude + stress sensitivity)
- agreeableness → trust + conflict events
- openness → novelty events
- conscientiousness → promise events
- extraversion → behavior only (not direct L3)

## L3 — Relationship Dimensions (0-100, Integer)

| Dimension | Key | Start | Meaning |
|-----------|-----|-------|---------|
| 信任感 | trust | 30 | 觉得你靠不靠谱 |
| 安全感 | security | 30 | 觉得不会被抛弃 |
| 亲密感 | closeness | 20 | 情感亲近程度 |
| 依恋度 | neediness | 20 | 多想和你待一起 |
| 占有欲 | possessiveness | 10 | 对你和别人的敏感度 |

**Level labels:** 0-20 冰点, 21-40 低, 41-60 中, 61-80 高, 81-100 满

## Three-Stage Modulation

```
effective_Δ = raw_Δ_enum × l2_factor × mood_factor
```

### Stage 1: Enum Delta (防 LLM 数值幻觉)

LLM chooses enum values, NOT integers:

| Enum | Value |
|------|-------|
| major_decrease | -10 |
| minor_decrease | -3 |
| neutral | 0 |
| minor_increase | +3 |
| major_increase | +10 |

**LLM MUST write CoT analysis before choosing delta.** Code layer does ENUM_TO_INT conversion.

### Stage 2: L2 Factor (0.5x ~ 1.5x)

Big Five personality modulates the delta amplitude. Example: high neuroticism amplifies negative deltas.

### Stage 3: Mood Factor

- Positive Δ: `(1 - 0.5 × stress/100)` → high stress weakens positive changes
- Negative Δ: `(1 + 0.5 × stress/100)` → high stress amplifies negative changes

## Stress System (0-100)

Independent short-term state, NOT part of L3 (relationship).

- Natural decay per turn: `base 3 + (50-neuroticism)/50 + conscientiousness/50`, min 1
- High neuroticism → slower decay
- High conscientiousness → slightly slower decay
- Affects all L3 changes via mood_factor

## Opening Strategies

After character generation, randomly assigned (NOT linked to personality):

| Strategy | Behavior | Collapse Method |
|----------|----------|-----------------|
| emotion | Character monologues (碎碎念) | User responds freely, first mention collapses |
| schrodinger | Character asks "你在干嘛？" | User's answer triggers collapse |
| observer | No opening message | User speaks first, triggers collapse |

**For emotion/schrodinger:** LLM only receives L2 + Stress. Prompt forbids mentioning location/weather/action.

**For observer:** `openingMessage` is empty. Controller shows "她正在在线..."

## revealedFacts Type Classification

| Type | Mutability | Examples |
|------|------------|----------|
| setting | Immutable once collapsed | location, occupation, appearance traits |
| experience | Revisable (with revision history) | experiences, feelings, opinions |

LLM context injection format:
- setting: plain text
- experience: `[可修订] <fact>`

## World Sync

### Weather
- Based on wttr.in curl query, 15-min cache
- Depends on `revealedMemory.locations.current` (quantum state)
- If location not collapsed: no weather injected, LLM doesn't fabricate

### Holidays
- `.data/holidays.json`: 16 fixed holidays + 4 lunar holidays
- Special dates auto-injected into context

### Time Awareness
- 7 periods: 凌晨(0-5) / 早晨(6-8) / 上午(9-11) / 中午(12-13) / 下午(14-17) / 傍晚(18-19) / 晚上(20-23)
- Exact hour injected
- Character naturally perceives time (3am: "你怎么还不睡？")

### Location Quantum State
- Profile does NOT pre-set location
- First mention of city → collapses to `revealedMemory.locations.current`
- Travel → `locations.current` temporarily changes, returns after
- Return decided by LLM naturally, no timers

## Emotion Depth System

### emotionHistory (shortTermState)
Last 3 turns of emotion + trigger:
```json
{"emotion": "害羞", "trigger": "被夸好看"}
```

### emotionalMemories (revealedMemory)
Long-term emotional memories. Added via `memoryUpdate.emotionalMemoriesAdd`:
```json
{"event": "他说喜欢我穿红裙子", "emotion": "开心", "significance": "高"}
```

### moodFactors (shortTermState)
Auto-calculated background mood factors:
- `timeOfDay`: based on current hour (7 periods)
- `chatDuration`: session length
- `recentEmotionTrend`: from emotionHistory

## State Narrative Translation

`buildStateNarrative()` converts numeric state to natural language for LLM context:

```
信任感：82/100 — 她很信赖你，愿意分享心事
安全感：45/100 — 她还有些不确定
压力：72/100 — 她最近有些焦虑
```

Functions: `dimToText()`, `stressToText()`, `l2ToText()`, `thresholdToText()`

## Debug 模式

Debug 模式控制调试命令的可用性。默认关闭。

**开关命令：**
- `debug on` — 开启 debug 模式
- `debug off` — 关闭 debug 模式

**重置：** 退出赛博女友后自动重置为关闭状态

**状态存储：** `~/.hermes/CyberPersona-hermes/.data/debug-mode.flag`

### Debug 命令列表

#### debug 状态
展示当前完整的内部状态：
```
📊 Debug 状态

【L2 人格 Big Five】
神经质(N): 65  █████████████░░░░░░░ 65/100
宜人性(A): 45  █████████░░░░░░░░░░░ 45/100
开放性(O): 70  ██████████████░░░░░░ 70/100
尽责性(C): 35  ███████░░░░░░░░░░░░░ 35/100
外向性(E): 55  ███████████░░░░░░░░░ 55/100

【L3 关系维度】
信任感: 48 (低)  ████████░░ 48/100
安全感: 35 (低)  ███████░░░ 35/100
亲密感: 40 (低)  ████████░░ 40/100
依恋度: 19 (冰点) ████░░░░░░ 19/100
占有欲: 5 (冰点)  █░░░░░░░░░ 5/100

【压力】
压力值: 65  █████████████░░░░░░░ 65/100

【情绪状态】
当前情绪: <currentEmotion>

【情绪历史】
1. <emotion> ← <trigger>
2. <emotion> ← <trigger>
3. <emotion> ← <trigger>

【记忆】
已揭示事实: X 条 (setting: X, experience: X)
情绪记忆: X 条

【游戏化】
好感度: X (<等级>)
成就: X/18
今日任务: X/6
```

#### debug 设置 <维度> <值>
维度名称：trust, security, closeness, neediness, possessiveness, stress
值范围：0-100

#### debug 场景 <场景名>
```
debug 场景 被夸奖       → 模拟被真诚夸奖
debug 场景 吵架         → 模拟发生小冲突
debug 场景 长时间未聊   → 模拟3天没聊天
debug 场景 表白         → 模拟用户表白
debug 场景 吃醋         → 模拟用户提到其他女生
```

## Full Turn Cycle

### 1. Start CyberPersona

```bash
cd ~/.hermes/CyberPersona-hermes && node cyber-gf-controller.js 开始赛博女友
```

- If state exists → restores, returns profileSummary + lastSummary
- If no state → returns `need_profile_generation` with prompt for `InitialStatePayload`

When entering: **automatically suppress gateway notifications** via flag file `~/.hermes/.suppress_gateway_notify`. Removed on exit/breakup.

### 1b. First-Time Profile Generation (no state file)

When there's no existing state, the agent must:

**第一步：生成随机种子**

```bash
cd ~/.hermes/CyberPersona-hermes && python3 scripts/random_character_seed.py
```

Output includes: Big Five personalitySettings, openingStrategy, speechHabits, attachmentStyle, quirks, etc.

**第二步：生成完整人设信息（LLM 推理）**

1. Generate `InitialStatePayload` JSON using the prompt from step 1. Must include ALL of these sections:
   - `profile` — object with REQUIRED keys: `coreSummary`, `relationshipSummary`, `defenseSummary`, `startSummary`, `voiceSummary`, `appearance`, `voiceDescription`, `profileSummary`
   - `personalitySettings` — Big Five values (neuroticism/agreeableness/openness/conscientiousness/extraversion)
   - `dynamicStateInit` — 5 integer values (0-100): trust, security, closeness, neediness, possessiveness
   - `shortTermStateInit` — object with `stress: 0` and optional `emotionHistory`, `moodFactors`
   - `revealedMemoryInit` — object (can be empty `{}`)
   - `openingMessage` — string (empty for observer strategy)
   - `openingStrategy` — emotion / schrodinger / observer
2. Save to `/tmp/cyber-gf-init-payload.json`

**第三步：并行生成三个产物**

并行执行以下三个任务：

**3.1 输出人物信息卡片**
- 根据 profile 内容，输出角色信息卡片（格式见下方）

**3.2 生成样本声音**
```bash
source ~/.hermes/.env && export MIMO_API_KEY="***" && export MIMO_BASE_URL="$MIMO_BASE_URL"
python3 ~/.hermes/skills/mimo-v2-5-tts/scripts/mimo_tts_voicedesign.py \
  --context "<voiceDescription from profile>" \
  --text "你好呀，今天天气真不错，我们出去走走吧。" \
  --output ~/.hermes/CyberPersona-hermes/.data/voice-sample.wav
```

**3.3 生成证件照**
```bash
source ~/.hermes/.env && export IMAGE_API_KEY="***" && export IMAGE_API_BASE="$IMAGE_API_BASE"
python3 ~/.hermes/skills/image-api/scripts/image_api.py \
  --json --size 1024x1024 --quality high --format png --moderation low \
  "standard portrait photo, head and shoulders, neutral gray background, looking at camera. <appearance description>"
```

**第四步：应用 start payload**

1. **Add voiceSamplePath to payload:**
```bash
cd ~/.hermes/CyberPersona-hermes && node -e "
const fs = require('fs');
const payload = JSON.parse(fs.readFileSync('/tmp/cyber-gf-init-payload.json', 'utf8'));
payload.profile.voiceSamplePath = '~/.hermes/CyberPersona-hermes/.data/voice-sample.wav';
fs.writeFileSync('/tmp/cyber-gf-init-payload.json', JSON.stringify(payload, null, 2));
console.log('voiceSamplePath added');
"
```

2. **Apply start payload:**
```bash
cd ~/.hermes/CyberPersona-hermes && node cyber-gf-controller.js apply-start-payload /tmp/cyber-gf-init-payload.json
```

**第五步：输出角色介绍**

Send in order:
- **Character info card** (format below)
- **Character photo**: reference photo from step 3.3
- **Character voice**: voice sample from step 3.2
- **Opening message**: character's first message (empty for observer strategy)

**Character info card format (v9.1.0):**
```
💗 新角色已生成

【基本信息】
姓名：<name>
年龄：<age>
性格：<personality summary>

【人格 Big Five】
神经质(N): X  宜人性(A): X  开放性(O): X  尽责性(C): X  外向性(E): X

【外貌】
<appearance description>

【声音】
<voice description>

【开场策略】
<emotion / schrodinger / observer>

【关系状态】
好感度: 0 (陌生 😐)
信任感: 30 (低)
安全感: 30 (低)
亲密感: 20 (冰点)
依恋度: 20 (冰点)
占有欲: 10 (冰点)

【游戏化】
成就: 0/18
今日任务: 0/6
```

### 2. User Sends a Message → Generate Turn

**Step A: Get turn context payload**
```bash
cd ~/.hermes/CyberPersona-hermes && node cyber-gf-controller.js turn-payload "<user message>"
```

Returns: full context JSON including:
- `profile` — character info + `personalitySettings`, `sessionSummaries`
- `dynamicState` — 5 integer dimensions
- `shortTermState` — `stress`, `emotionHistory`, `moodFactors`
- `revealedMemory` — `revealedFacts` (with type), `emotionalMemories`, `locations`
- `worldContext` — `weather`, `holiday`, `timeOfDay`, `hour`
- `stateNarrative` — natural language translation of state
- `recentContext`, `userMessage`

**Step B: Generate TurnResultPayload as the character**

Using the context from Step A, generate a JSON response:
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
  "reasoning": "CoT analysis before choosing deltas",
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

**Key changes from v8.0:**
- ❌ `stateDelta` integer values — NOW enum strings
- ❌ `voiceTendency` — REMOVED (merged into closeness)
- ✅ `reasoning` — CoT analysis required before delta selection
- ✅ `stressDelta` — enum string for stress change
- ✅ `stateDelta` — enum strings: major_decrease/minor_decrease/neutral/minor_increase/major_increase

Save to `/tmp/cyber-gf-turn-result.json` then apply.

**Step C: Apply turn result**
```bash
cd ~/.hermes/CyberPersona-hermes && node cyber-gf-controller.js apply-turn-payload "$(cat /tmp/cyber-gf-turn-result.json)"
```

**Step D: Generate TTS + send voice (if sendVoiceNow=true)**

Agent calls mimo-tts skill scripts directly. TTS text = `visibleText`:

**日常语音（clone 模式）：**
```bash
source ~/.hermes/.env && export MIMO_API_KEY="***" && export MIMO_BASE_URL="$XIAOMI_BASE_URL"
python3 ~/.hermes/skills/mimo-v2-5-tts/scripts/mimo_tts_voiceclone.py \
  --voice-file ~/.hermes/CyberPersona-hermes/.data/voice-sample.wav \
  --context "自然语言风格控制" \
  --text "visibleText的内容" \
  --output /tmp/cyber-gf-tts-output.wav
ffmpeg -y -i /tmp/cyber-gf-tts-output.wav -c:a libopus -b:a 32k /tmp/cyber-gf-tts-output.ogg
```

**唱歌（preset 模式，clone 不支持唱歌）：**
```bash
source ~/.hermes/.env && export MIMO_API_KEY="***" && export MIMO_BASE_URL="$XIAOMI_BASE_URL"
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

**沉浸感规则：当 sendVoiceNow=true 时，只发送语音，不要重复发送 visibleText 的文字消息。**

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

## Modules (7 — all integrated)

| Module | File | Integration Point |
|--------|------|-------------------|
| Config | `cyber-gf-config.js` | Configuration loading |
| State | `cyber-gf-state.js` | State CRUD + L2/L3 modulation + stress + emotionHistory + moodFactors |
| Profile | `cyber-gf-profile.js` | Initial profile validation (Big Five + 5 L3 dims) |
| Turn | `cyber-gf-turn.js` | Turn output validation (enum deltas, stressDelta) |
| Prompts | `cyber-gf-prompts.js` | LLM prompt construction (v9.1.0 full rewrite) |
| Gamification | `cyber-gf-gamification.js` | Achievements, affection, daily tasks, collections |
| Controller | `cyber-gf-controller.js` | Main orchestrator, CLI, delivery, world context |

## Gamification System

**Achievements (18):** first_conversation, ten_conversations, hundred_conversations, first_voice, voice_master, first_selfie, photo_collector, first_heartbeat, trust_fall, soulmate, one_week, one_month, one_year, night_owl, early_bird, all_night, nickname_collector, memory_keeper

**Achievement conditions:** use integer thresholds (>= 80)

**Affection levels:** 陌生(0-100) → 认识(101-300) → 友好(301-500) → 亲密(501-700) → 心动(701-900) → 恋人(901-1000)

**Affection gain:** daily_chat(+5), voice_message(+10), photo_share(+15), deep_conversation(+20), emotional_support(+25), special_event(+30), achievement_unlock(+50)

**Affection deduction (v9.1.1):** Based on `stateDelta` from turn result:
- `major_decrease` ≥ 2 dimensions → -30 (relationship collapse)
- `negative` (any decrease) ≥ 3 dimensions → -15 (relationship conflict)
- `major_decrease` ≥ 1 dimension → -8 (relationship setback)

**Daily tasks:** 早安问候, 晚安问候, 分享心情, 语音聊天, 照片分享, 深入对话

## Key Pitfalls

1. **Voice delivery must use `send_message` tool**, not inline `MEDIA:` in response text.

2. **TTS uses mimo-v2-5-tts skill** — Agent calls MiMo TTS Python scripts directly. TTS text = `visibleText`.

3. **TTS Architecture — Voice Design→Clone Workflow:**
   - **Character creation:** voiceDescription → `mimo_tts_voicedesign.py` → voice sample → `profile.voiceSamplePath`
   - **Every voice turn:** `mimo_tts_voiceclone.py --voice-file <sample>` → consistent voice
   - **Singing:** Clone does NOT support singing. Fallback: `mimo_tts.py --voice "茉莉" --text "(唱歌)歌词"`

4. **State file**: `~/.hermes/CyberPersona-hermes/.cyber-gf-state.json` (project root, NOT `.data/`).

5. **Image generation**: Agent calls image-api skill Python scripts directly. Use: `python3 ~/.hermes/skills/image-api/scripts/image_api.py --json ...`. 15-30s for generate, 60-180s for edits. **Use timeout >= 180s.**

6. **Image API failure modes & retry strategy:**
   - **Timeout (120s+)**: API can hang. Set terminal timeout to 180s.
   - **JSON decode error**: Retry with shorter prompt.
   - **Edit API failure**: Fallback to generate API.
   - **Retry order**: generate → generate with shorter prompt → edit with reference photo.

7. **Gateway notification suppression** — Uses flag file `~/.hermes/.suppress_gateway_notify`.

8. **Singing (唱歌)** — Only with preset voices (`mimo-v2.5-tts`). Voice clone does NOT support singing.

9. **`gamification.state` is undefined in controller scope** — The gamification module exports functions, NOT a `state` object. Use `const state = loadState(); ... applyStateDelta(state, ...); saveState(state);`.

10. **Enum delta validation** — `stateDelta` values MUST be enum strings (major_decrease/minor_decrease/neutral/minor_increase/major_increase). Code rejects integers.

11. **Stress is NOT part of L3** — It's independent short-term state. Don't put stress in `dynamicState`.

12. **revealedFacts type** — `setting` type is immutable once collapsed. `experience` type is revisable with revision history.

13. **Location quantum state** — Profile does NOT pre-set location. `revealedMemory.locations.current` starts as null. First mention of city collapses it.

14. **World context depends on location collapse** — Weather is only injected when `locations.current` is non-null. Time and holidays are always injected.

15. **Opening strategy is random** — NOT linked to personality. Don't infer personality from opening strategy.

16. **Always verify state before processing a turn** — Check `profile.coreSummary` non-empty and `mode.enabled === true`.

17. **Context compaction can break the runtime loop** — After compaction, re-enter with `开始赛博女友`.

18. **L2 factor: N must NOT appear twice** — `baseFactor` already includes neuroticism. The inner formula for neediness/possessiveness must NOT add `n` again, or it creates quadratic amplification (N=90 → factor 1.89 instead of 1.26). This was fixed in v9.1.1.

19. **Gamification: negative deltas must deduct affection** — `recordInteraction` receives `stateDelta` from the turn result. If multiple dimensions show `major_decrease`, affection is deducted (-8 to -30). Without this, affection rises even when the relationship is tanking.

20. **`analysis` is a required turn field** — LLM must write CoT reasoning before choosing enum deltas. `validateTurnOutput` rejects turns missing the `analysis` field.

21. **Quantum state: code-layer enforcement** — `validateInitialProfile` rejects non-empty `revealedFacts`/`emotionalMemories`/`importantEvents`. Additionally, `applyInitialStatePayload` force-clears these arrays as a double safety net. LLM cannot leak facts into initial state.

22. **Timezone: always use Asia/Shanghai** — `getTimeOfDay()` uses `toLocaleString("en-US", {timeZone: "Asia/Shanghai"})` to ensure correct time perception regardless of server location.

23. **recentContext: 10 messages, not 3** — `getRecentContext(limit=10)` and `slice(-10)` give the LLM 5 full turns of context.恋爱模拟需要上下文拉扯，3 条太短会导致"鱼的记忆"。

24. **State version migration** — `createEmptyState()` has `version: 2`. `repairState()` auto-migrates v1→v2: removes `voiceTendency`, renames `intimacy→closeness`/`attachment→neediness`/`jealousy→possessiveness`, ensures `personalitySettings` + `stress` exist.

## Character Response Guidelines (v9.2.0)

When generating TurnResultPayload:
- **真实感优先于讨好感** — authentic over pleasing
- **上下文驱动推理，不执行规则** — "这个人+这时候+怎么回复"
- **CoT first** — Write reasoning BEFORE choosing enum deltas
- **Enum deltas** — Use major_decrease/minor_decrease/neutral/minor_increase/major_increase
- **stressDelta** — Separate from relationship deltas
- `sendVoiceNow=true` for emotional moments, not every turn
- `sendGifNow=true` for expression reactions
- `lastSummary` must be a concise relationship snapshot
- Check `revealedFacts` before introducing past facts (setting = immutable, experience = revisable)
- Check `emotionHistory` for emotional continuity
- Check `sessionSummaries` for cross-session memory
- Check `worldContext` for weather/holiday/time awareness
- Check `stateNarrative` for natural language state description
- **Emotion expression:** 害羞→短句省略号, 开心→感叹号emoji, 低落→长句沉默, 生气→直接反问
- **User emotion perception:** notice user's emotional tone and adjust

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

**重置：** 退出赛博女友后自动重置为关闭状态

**状态存储：** `~/.hermes/CyberPersona-hermes/.data/cheat-mode.flag`

**Cheat 开启时展示的内容：**
- 开始信息：上次回顾 + 当前关系状态
- 回合小结：状态变化 + 情绪转变 + 动态评价 + 聊天建议
- 退出总结：完整详细总结

**Cheat 关闭时：**
- 开始：只显示 `<角色名> 已上线 💕`（observer 策略显示"她正在线上..."）
- 回合：只发送角色回复（文字/语音/图片/贴纸），不附带任何小结
- 退出：只显示 `已退出赛博女友模式 💕`

### 1. 开始信息（进入模式时）

**Cheat 开启时发送：**
```
赛博女友模式已开启 ✨

<角色名> 已上线 💕

【上次回顾】
<从 profile.sessionSummaries 和 revealedMemory.lastSummary 提取>

【当前关系状态】
好感度: X (<等级>)
信任感: X (<等级>)
安全感: X (<等级>)
亲密感: X (<等级>)
依恋度: X (<等级>)
占有欲: X (<等级>)

【压力】
压力值: X/100
```

**Cheat 关闭时发送：**
```
<角色名> 已上线 💕
```

### 2. 回合小结（每轮对话后）

**Cheat 开启时：**
```
📊 回合小结

状态变化： <维度> <变化量>（<旧值>→<新值>），...
情绪转变： <上一轮情绪> → <本轮情绪>（<触发原因>）
压力变化： <旧值> → <新值>
动态： <对这轮对话的评价>

💡 聊天建议：<基于当前状态的回复方向>
```

### 3. 退出总结（退出模式时）

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
- 😰 压力： X → X
- 💗 好感度： X → X（<等级>）
- 🏆 成就： X/18

【对话评价】
<整体评价>

【记忆更新】
<session-summary 保存结果>
```

**Cheat 关闭时发送：**
```
已退出赛博女友模式 💕
```

## Dependency Skill Sources

- **mimo-v2-5-tts**: [XiaomiMiMo/MiMo-Skills](https://github.com/XiaomiMiMo/MiMo-Skills) — install via `npx skills add XiaomiMiMo/MiMo-Skills` or git clone + symlink. Requires `MIMO_API_KEY`.
- **image-api**: [harrylarryxyz/image-api](https://github.com/harrylarryxyz/image-api) — 通用图片生成与编辑，支持任意 OpenAI 兼容 provider。安装：`git clone https://github.com/harrylarryxyz/image-api.git ~/.hermes/skills/image-api`。需要 `IMAGE_API_KEY` + `IMAGE_API_BASE` 环境变量。
- **mood-sticker**: [clawhub.ai/chensanle/sticker](https://clawhub.ai/chensanle/sticker) — Hermes skill bundle install. Free, no API key.
