# CyberPersona 赛博女友

基于 Hermes Agent 的角色扮演系统。通过结构化的状态管理、情绪深度系统、图片生成和游戏化机制，实现一个有记忆、有性格、会成长的赛博女友。

## 特性

- **情绪深度系统** — 6 维度积分制（信任感/安全感/亲密感/依恋度/占有欲/语音倾向度），情绪历史，长期情绪记忆
- **记忆系统** — 跨 session 摘要，角色记忆（revealedFacts），情绪记忆（emotionalMemories）
- **语音** — Agent 直接调用 mimo-tts Python 脚本（voice design → clone 工作流），不再通过 JS 包装层
- **图片** — Agent 直接调用 image-api Python 脚本，gpt-image-2 生成 + 参考照片 edit API
- **表情包** — tangdouz API 免费表情包搜索，情绪驱动
- **游戏化** — 18 个成就，好感度系统（0-1000），每日任务，收集系统
- **上下文驱动** — LLM 根据完整上下文自然推理，不依赖规则引擎
- **Cheat 模式** — `cheat on/off` 控制信息展示（回合小结、聊天建议、详细总结）
- **Debug 模式** — `debug on/off` + 丰富的调试命令（状态查看、记忆查看、状态修改、场景模拟）

## 快速开始

### 环境要求

- Node.js >= 18
- Python 3.10+（MiMo TTS, image-api）
- ffmpeg（语音转码）
- Hermes Agent（运行环境）

### 安装

```bash
# 1. 克隆项目
git clone https://github.com/harrylarryxyz/CyberPersona.git
cd CyberPersona

# 2. 安装依赖 Skill（见下方「关联 Skill」章节）
# mimo-v2-5-tts, image-api, mood-sticker

# 3. 配置环境变量
cp .env.cyber-gf.example .env.cyber-gf
# 编辑 .env.cyber-gf 填入 API keys
```

### 使用

在 Hermes Agent 中说 `开始赛博女友` 即可启动。

#### Cheat 模式

控制信息展示（回合小结、聊天建议、详细退出总结）：

```
开始赛博女友 cheat on    # 启动时开启
cheat on                 # 对话中开启
cheat off                # 对话中关闭
```

退出后自动重置为关闭状态。

#### Debug 模式

调试命令，需先 `debug on` 开启：

```
debug on                 # 开启 debug 模式
debug off                # 关闭 debug 模式
debug 状态               # 查看内部状态
debug 记忆               # 查看所有记忆
debug 设置 trust 80      # 修改维度
debug 场景 被夸奖        # 模拟场景
debug 发语音 晚安        # 测试语音
debug 发照片             # 测试图片
debug 发表情 害羞        # 测试贴纸
```

## 架构

```
├── cyber-gf-config.js        # 配置加载
├── cyber-gf-controller.js    # 主控制器，CLI 入口，交付逻辑
├── cyber-gf-state.js         # 状态管理（动态状态、情绪历史、氛围因子）
├── cyber-gf-profile.js       # 角色档案验证与初始化
├── cyber-gf-turn.js          # 回合输出验证
├── cyber-gf-prompts.js       # LLM prompt 构建
├── cyber-gf-gamification.js  # 游戏化系统（成就/好感度/任务/收集）
└── docs/
    └── DESIGN-EMOTIONAL-DEPTH.md  # 情绪深度系统设计文档
```

## 关联 Skill

本项目依赖以下 3 个 Hermes Agent Skill，需单独安装：

### 1. `mimo-v2-5-tts` — MiMo TTS 语音合成

来源：[XiaomiMiMo/MiMo-Skills](https://github.com/XiaomiMiMo/MiMo-Skills)

```bash
# 方式一：npx（推荐）
npx skills add XiaomiMiMo/MiMo-Skills --skill mimo-v2-5-tts

# 方式二：手动
git clone https://github.com/XiaomiMiMo/MiMo-Skills.git ~/.mimo-skills
ln -s ~/.mimo-skills/skills/mimo-v2-5-tts ~/.hermes/skills/mimo-v2-5-tts
```

需要 `MIMO_API_KEY` 环境变量（[小米 MiMo 开放平台](https://platform.xiaomimimo.com/)申请）。

### 2. `image-api` — gpt-image-2 图片生成与编辑

自定义 Skill，需手动放入 `~/.hermes/skills/image-api/`。包含 `scripts/image_api.py`，通过 OpenAI 兼容 API 调用 gpt-image-2 模型。

需要 `IMAGE_API_KEY` 和 `IMAGE_API_BASE` 环境变量。

### 3. `mood-sticker` — 表情包搜索

来源：[clawhub.ai/chensanle/sticker](https://clawhub.ai/chensanle/sticker)

Hermes skill bundle 安装，或手动放入 `~/.hermes/skills/sticker/`。使用 tangdouz API，免费无需 API key。

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

| 依赖 | 用途 | 来源 |
|------|------|------|
| Hermes Agent | 运行环境，工具链 | [hermes-agent](https://hermes-agent.nousresearch.com) |
| mimo-v2-5-tts | 语音合成（voice design + clone） | [XiaomiMiMo/MiMo-Skills](https://github.com/XiaomiMiMo/MiMo-Skills) |
| image-api | 图片生成与编辑（gpt-image-2） | 自定义 Skill（未发布） |
| mood-sticker | 表情包搜索（tangdouz API，免费） | [clawhub.ai/chensanle/sticker](https://clawhub.ai/chensanle/sticker) |
| ffmpeg | 语音格式转码（wav→ogg） | 系统包 |

## License

MIT
