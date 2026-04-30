# 赛博女友进化设计文档

> Grill Me 会话产出 — 2026-04-30
> 基于当前 v7.0 架构的增量改进方案

---

## 一、情感深度

### 1.1 emotionHistory（新增）

**位置：** `shortTermState.emotionHistory`
**类型：** 数组，最近3轮

```json
{
  "emotionHistory": [
    {"emotion": "害羞", "trigger": "被夸好看"},
    {"emotion": "开心", "trigger": "聊到共同爱好"},
    {"emotion": "低落", "trigger": "提到前任"}
  ]
}
```

**作用：** LLM 生成时参考情绪连续性，避免情绪突变。连续3轮低落不应突然大笑，除非有强触发。

**实现：** 每轮 apply-turn-payload 时，从 TurnResultPayload 的 currentEmotion 提取，push 到 shortTermState，保留最近3条。

### 1.2 emotionalProfile（新增）

**位置：** `profile.emotionalProfile`
**类型：** 对象，角色创建时 LLM 自动生成

```json
{
  "emotionalProfile": {
    "baseline": "热情外向、表达直接、偶尔会突然安静下来",
    "vulnerabilityTopics": [
      {"topic": "童年经历", "description": "父母离异，跟妈妈长大"},
      {"topic": "真实不安全感", "description": "怕被抛弃，怕不被需要"},
      {"topic": "深层恐惧", "description": "害怕孤独终老"}
    ]
  }
}
```

**设计原则：**
- `baseline` 描述角色天然的情绪表达方式（性格，不分阶段）
- `vulnerabilityTopics` 只控制**话题深度**，不控制表达风格
- 不设 `expressionByStage` — 表达方式由性格决定，不由关系阶段规定
- LLM 自行推理："这个性格的人，在当前关系状态下，面对这个用户消息，会怎么回应"
- 信任度低时不会主动提起 vulnerabilityTopics，但有强触发可以突破

### 1.3 emotionalMemories（新增）

**位置：** `memoryUpdate.emotionalMemoriesAdd`
**类型：** 数组，长期存储在 state 里

```json
{
  "emotionalMemoriesAdd": [
    {"event": "他说喜欢我穿红裙子", "emotion": "开心", "significance": "高"},
    {"event": "他忘记我生日", "emotion": "委屈", "significance": "高"}
  ]
}
```

**作用：** 跨 session 的情绪记忆。当相关场景再次出现时，LLM 自然引用或流露。和 emotionHistory（短期）互补。

### 1.4 moodFactors（新增）

**位置：** `shortTermState.moodFactors`
**类型：** 对象，由代码自动计算

```json
{
  "moodFactors": {
    "timeOfDay": "深夜",
    "chatDuration": "长",
    "recentEmotionTrend": "连续开心"
  }
}
```

**计算逻辑：**
- `timeOfDay` — 根据当前时间：清晨/上午/下午/傍晚/深夜/凌晨
- `chatDuration` — 根据 sessionStartTime：短(<30min)/中(30-120min)/长(>120min)
- `recentEmotionTrend` — 从 emotionHistory 提取趋势

**规则：** 只加温和的背景影响，不加随机负面。深夜感性、聊天久了有点累 → 自然。随机心情差 → 不加。

### 1.5 用户情绪感知

**方式：** 隐式，不加新字段
**实现：** 在生成 TurnResultPayload 的 prompt 里加一句引导：
> "注意用户消息的情绪基调，据此调整你的回应方式。用户疲惫时安静陪伴，用户兴奋时匹配能量。"

### 1.6 情绪与表达

**方式：** prompt 引导
**实现：** 在 prompt 里加情绪表达指导：
```
情绪影响你的表达方式：
- 害羞：短句、省略号、转移话题、语音轻声
- 开心：感叹号、emoji、主动分享、语音活泼
- 低落：长句、沉默、简短回复、语音低沉
- 生气：直接、反问、不加emoji、语音冷淡
```

### 1.7 删除死字段

从 TurnResultPayload 结构中删除：
- `taggedTtsText` — TTS 已改为 mimo-tts skill 直接调用
- `naturalStylePrompt` — 同上

---

## 二、记忆力

### 2.1 sessionSummaries（新增）

**位置：** state 文件里的 `sessionSummaries` 数组
**生成方式：** 退出赛博女友时，LLM 生成当前 session 摘要

```json
{
  "sessionSummaries": [
    {
      "date": "2026-04-30",
      "turnCount": 24,
      "summary": "他提到工作压力大，你安慰了他。后来聊到周末计划，他说想一起看电影。",
      "keyEvents": ["工作压力", "周末看电影计划"],
      "emotionalTone": "从低落到放松到开心"
    }
  ]
}
```

**保留策略：**
- 最近5个 session 保留完整摘要
- 更早的合并为一句话存入 `revealedFacts`

**注入方式：** `turn-payload` 返回的上下文里加 `sessionSummaries` 字段

---

## 三、多模态

### 3.1 表情包（新增）

**方式：** sticker skill — tangdouz API
**已安装：** `~/.hermes/skills/sticker/`

**流程：**
1. LLM 决定 `sendGifNow=true` + `gifKeyword="害羞"`
2. Agent 调 API：`curl -s -m 5 "https://api.tangdouz.com/a/biaoq.php?return=json&nr=害羞"`
3. 随机选一张 → 下载 → send_message 发送

**TurnResultPayload 新增字段：**
- `sendGifNow` — boolean，是否发表情包
- `gifKeyword` — 中文关键词（害羞/开心/生气/无语/可爱等）

### 3.2 Emoji

**方式：** 在 visibleText 里直接使用
**引导：** prompt 里加 "善用 emoji 表达情绪：😂🥺😭💕😤🥰"

### 3.3 场景分配

| 场景 | 方式 | 延迟 | 成本 |
|------|------|------|------|
| 表情反应 | 表情包 API | 1-2s | 免费 |
| 文字情绪 | emoji | 0s | 免费 |
| 真实照片 | gpt-image-2 | 15-30s | 付费 |
| 日常语音 | MiMo TTS clone | 3-5s | API |
| 唱歌 | MiMo TTS preset | 5-10s | API |

---

## 四、关系维度系统

### 4.1 六个关系维度（动态，积分制 0-100）

替换旧的6个维度（关系温度、安全感、信任感、主动靠近意愿、暴露意愿、语音自然度）。

| 维度 | 含义 | 低值表现 | 高值表现 |
|------|------|----------|----------|
| 信任感 | 觉得你靠不靠谱 | 试探、不分享私事 | 直接表达、暴露弱点 |
| 安全感 | 觉得不会被抛弃 | 患得患失、试探 | 放松、撒娇、敢闹脾气 |
| 亲密感 | 情感亲近程度 | 客气、保持距离 | 不设防、展示真实自我 |
| 依恋度 | 多想和你待一起 | 不主动找你、回复慢 | 主动发消息、想见你 |
| 占有欲 | 对你和别人的敏感度 | 大方、不介意 | 吃醋、追问、小脾气 |
| 语音倾向度 | 愿不愿意发语音 | 只发文字 | 经常发语音、语音撒娇 |

### 4.2 积分规则

每个维度 0-100，分档：
- 0-20：冰点
- 21-40：低
- 41-60：中
- 61-80：高
- 81-100：满

**分值参考范围（prompt 里给 LLM）：**
```
- 小事（日常互动）：±1~5
- 中等事件（被夸、被冷落）：±5~15
- 重大事件（吵架、道歉、重要日子）：±15~30
- 极端事件（背叛、表白、分手边缘）：±30~50
```

LLM 根据场景自主判断分值幅度，不过度限制。

### 4.3 维度间联动（prompt 引导）

```
维度之间有自然联动：
- 信任感高 → 亲密感更容易涨
- 安全感低 + 依恋度高 → 焦虑型依恋（粘人又不安）
- 占有欲高 + 安全感低 → 频繁吃醋、质问
- 亲密感高 + 信任感低 → 矛盾（想靠近但不敢）
```

### 4.4 删除旧维度

| 旧维度 | 处理 |
|--------|------|
| 关系温度 | 合并到亲密感 |
| 暴露意愿 | 合并到亲密感 |
| 主动靠近意愿 | 改名为依恋度 |
| 语音自然度 | 改名为语音倾向度 |

---

## 五、交互模式

### 5.1 互动引导（prompt）

在 prompt 里加：
```
偶尔主动发起小互动，保持新鲜感：
- "我出个谜语你猜猜？"
- "我们玩个联想游戏吧，我说一个词你接"
- "今天轮到你问我一个问题"
- "我们假装第一次见面，重新认识一下？"
不要每次都互动，正常对话为主，偶尔穿插。
```

---

## 六、上下文驱动推理（核心设计原则）

**不加规则引擎，给 LLM 足够上下文让它自然推理。**

turn-payload 返回的完整上下文：
- `profile` — 她是谁（性格、外貌、声音、背景、emotionalProfile）
- `dynamicState` — 6个关系维度积分
- `emotionHistory` — 最近3轮情绪
- `moodFactors` — 当前氛围因子
- `emotionalMemories` — 长期情绪记忆
- `sessionSummaries` — 最近5次 session 摘要
- `revealedFacts` — 长期关键事实
- `userMessage` — 用户消息

**Prompt 核心指令：**
> "根据你作为这个人的全部特质和当前处境，自然地回应。你不是一个在执行规则的程序，你是一个活生生的人。信任度低时不会主动暴露深层话题，但如果有强烈触发可以突破。关注用户情绪并据此调整你的状态和回应。"

---

## 七、实施优先级

1. **P0 — stateDelta 积分制 + 6维度** — 核心改动，影响每一轮
2. **P0 — emotionHistory** — 情绪连续性的基础
3. **P1 — emotionalProfile** — 角色创建时生成
4. **P1 — emotionalMemories** — 长期情绪记忆
5. **P1 — sessionSummaries** — 跨 session 记忆
6. **P2 — moodFactors** — 氛围因子
7. **P2 — 表情包集成** — sendGifNow + gifKeyword
8. **P2 — 删除死字段** — 清理 TurnResultPayload
9. **P3 — prompt 全面重写** — 整合所有新上下文
