# CyberPersona 赛博女友

基于 Hermes Agent 的角色扮演系统。通过结构化的状态管理、情绪深度系统、TTS 语音、图片生成和游戏化机制，实现一个有记忆、有性格、会成长的赛博女友。

## 特性

- **情绪深度系统** — 6 维度积分制（信任感/安全感/亲密感/依恋度/占有欲/语音倾向度），情绪历史，长期情绪记忆
- **记忆系统** — 跨 session 摘要，角色记忆（revealedFacts），情绪记忆（emotionalMemories）
- **语音** — MiMo TTS voice design → clone 工作流，角色音色一致性
- **图片** — gpt-image-2 生成 + 参考照片 edit API，人物形象一致
- **表情包** — tangdouz API 免费表情包搜索，情绪驱动
- **游戏化** — 18 个成就，好感度系统（0-1000），每日任务，收集系统
- **上下文驱动** — LLM 根据完整上下文自然推理，不依赖规则引擎

## 快速开始

### 环境要求

- Node.js >= 18
- Python 3.10+（MiMo TTS, image-api）
- ffmpeg（语音转码）
- Hermes Agent（运行环境）

### 安装

```bash
git clone https://github.com/YOUR_USERNAME/CyberPersona.git
cd CyberPersona
cp .env.cyber-gf.example .env.cyber-gf
# 编辑 .env.cyber-gf 填入 API keys
```

### 使用

在 Hermes Agent 中说 `开始赛博女友` 即可启动。

## 架构

```
├── cyber-gf-controller.js    # 主控制器，CLI 入口，交付逻辑
├── cyber-gf-state.js         # 状态管理（动态状态、情绪历史、氛围因子）
├── cyber-gf-profile.js       # 角色档案验证与初始化
├── cyber-gf-turn.js          # 回合输出验证
├── cyber-gf-prompts.js       # LLM prompt 构建
├── cyber-gf-gamification.js  # 游戏化系统（成就/好感度/任务/收集）
├── cyber-gf-image.js         # 图片生成与编辑
├── cyber-gf-image-optimizer.js # 图片文件索引
├── cyber-gf-tts.js           # TTS（已废弃，agent 直接调用 mimo-tts skill）
├── cyber-gf-config.js        # 配置加载
└── docs/
    └── DESIGN-EMOTIONAL-DEPTH.md  # 情绪深度系统设计文档
```

## 状态系统

### 动态维度（0-100 积分制）

| 维度 | Key | 初始值 | 含义 |
|------|-----|--------|------|
| 信任感 | trust | 30 | 觉得你靠不靠谱 |
| 安全感 | security | 30 | 觉得不会被抛弃 |
| 亲密感 | intimacy | 20 | 情感亲近程度 |
| 依恋度 | attachment | 20 | 多想和你待一起 |
| 占有欲 | jealousy | 10 | 对你和别人的敏感度 |
| 语音倾向度 | voiceTendency | 10 | 愿不愿意发语音 |

分档：0-20 冰点 / 21-40 低 / 41-60 中 / 61-80 高 / 81-100 满

### 情绪深度

- **emotionHistory** — 最近 3 轮情绪 + 触发原因
- **emotionalProfile** — 角色情绪特质（baseline + vulnerabilityTopics）
- **emotionalMemories** — 长期情绪记忆
- **moodFactors** — 自动计算的氛围因子（时间段、聊天时长）

### 记忆

- **revealedFacts** — 角色已暴露的个人信息
- **sessionSummaries** — 最近 5 次 session 摘要（LLM 生成）
- **lastSummary** — 当前 session 关系快照

## TurnResultPayload

每轮对话 LLM 输出的结构化 JSON：

```json
{
  "visibleText": "给用户看的文字",
  "currentEmotion": "情绪标签",
  "sendVoiceNow": false,
  "sendImageNow": false,
  "imagePrompt": "英文图片描述",
  "imageCaption": "图片配文",
  "sendGifNow": false,
  "gifKeyword": "表情包中文关键词",
  "stateDelta": {
    "trust": 5, "security": 0, "intimacy": 8,
    "attachment": 0, "jealousy": 0, "voiceTendency": 0
  },
  "shortTermUpdate": { ... },
  "memoryUpdate": { ... }
}
```

## 游戏化

- **好感度** — 0-1000，6 个等级：陌生→认识→友好→亲密→心动→恋人
- **成就** — 18 个（互动/语音/图片/关系/时间/收集类）
- **每日任务** — 早安/晚安/分享心情/语音/照片/深入对话
- **收集** — 照片集/语音集/回忆录/成就墙

## 依赖

| 依赖 | 用途 |
|------|------|
| Hermes Agent | 运行环境，工具链 |
| MiMo V2.5 TTS | 语音合成（voice design + clone） |
| Image API (gpt-image-2) | 图片生成与编辑 |
| mood-sticker | 表情包搜索（tangdouz API，免费） |
| ffmpeg | 语音格式转码（wav→ogg） |

## License

MIT
