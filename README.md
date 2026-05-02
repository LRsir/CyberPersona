# CyberPersona 赛博女友

基于 Hermes Agent 的角色扮演系统。通过结构化的状态管理、情绪深度系统、图片生成和游戏化机制，实现一个有记忆、有性格、会成长的赛博女友。

**核心设计哲学：量子态**
> 没有提及就是无限可能，一旦提及，则立刻限定。系统不创造角色，角色通过对话创造自己。

## 特性

- **量子态角色生成** — 种子只给「轴」不给「点」，角色通过对话自然坍缩出完整人格（代码层硬约束：validator 拒绝 + 强制清空，物理隔离量子态泄漏）
- **大五人格系统** — L2 层 Big Five（神经质/宜人性/开放性/尽责性/外向性），心理学理论支撑
- **五维度关系系统** — L3 层（信任感/安全感/亲密感/依恋度/占有欲），动态积分制 0-100
- **三阶段调制** — `effective_Δ = raw_Δ_enum × l2_factor × mood_factor`，枚举化防幻觉
- **压力系统** — 独立短期状态，通过 mood_factor 影响所有关系维度变化
- **情绪深度** — emotionHistory / emotionalMemories / moodFactors，情绪驱动行为
- **世界观同步** — 天气感知（wttr.in）、节日感知、时间感知（7 时段），位置量子态坍缩
- **三种开场策略** — 纯情绪碎碎念 / 薛定谔提问 / 观测者静默，随机分配
- **记忆系统** — 跨 session 摘要，角色记忆（revealedFacts，setting 不可变 / experience 可修订）
- **语音** — Agent 直接调用 mimo-tts（voice design → clone 工作流）
- **图片** — Agent 直接调用 image-api，gpt-image-2 生成 + 参考照片 edit API
- **表情包** — tangdouz API 免费表情包搜索，情绪驱动
- **游戏化** — 18 个成就，好感度系统（0-1000），每日任务，收集系统
- **Cheat 模式** — `cheat on/off` 控制信息展示（回合小结、聊天建议、详细总结）
- **Debug 模式** — `debug on/off` + 丰富的调试命令

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

# 2. 安装 Hermes Skill（让 Hermes Agent 知道如何使用本项目）
mkdir -p ~/.hermes/skills/hermes/cyber-persona
cp SKILL.md ~/.hermes/skills/hermes/cyber-persona/

# 3. 安装依赖 Skill（见下方「关联 Skill」章节）
# mimo-v2-5-tts, image-api, mood-sticker

# 4. 配置环境变量
cp .env.cyber-gf.example .env.cyber-gf
# 编辑 .env.cyber-gf 填入 API keys：
# - MIMO_API_KEY（小米 MiMo 开放平台）
# - MIMO_BASE_URL（小米 MiMo API 地址）
# - IMAGE_API_KEY（图片生成 API）
# - IMAGE_API_BASE（图片生成 API 地址）
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
├── SKILL.md                         # Hermes Agent Skill 文件
├── cyber-gf-config.js               # 配置加载
├── cyber-gf-controller.js           # 主控制器，CLI 入口，交付逻辑
├── cyber-gf-state.js                # 状态管理（动态状态、情绪历史、L2/L3 调制）
├── cyber-gf-profile.js              # 角色档案验证与初始化
├── cyber-gf-turn.js                 # 回合输出验证（枚举 delta）
├── cyber-gf-prompts.js              # LLM prompt 构建（State Narrative Translation）
├── cyber-gf-gamification.js         # 游戏化系统（成就/好感度/任务/收集）
├── scripts/
│   └── random_character_seed.py     # 随机角色种子生成（Big Five + 开场策略）
├── .data/
│   ├── holidays.json                # 节日数据
│   └── world-cache.json             # 天气缓存
└── docs/
    └── DESIGN-EMOTIONAL-DEPTH.md    # 情绪深度系统设计文档
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

来源：[harrylarryxyz/image-api](https://github.com/harrylarryxyz/image-api)

```bash
git clone https://github.com/harrylarryxyz/image-api.git ~/.hermes/skills/image-api
```

需要 `IMAGE_API_KEY` 和 `IMAGE_API_BASE` 环境变量。支持任意 OpenAI 兼容的图片生成服务。

### 3. `mood-sticker` — 表情包搜索

来源：[clawhub.ai/chensanle/sticker](https://clawhub.ai/chensanle/sticker)

Hermes skill bundle 安装，或手动放入 `~/.hermes/skills/sticker/`。使用 tangdouz API，免费无需 API key。

## 状态系统

### 四层架构

| 层级 | 名称 | 特性 | 说明 |
|------|------|------|------|
| L1 | 物理层 | 不可变 | 名字、年龄、性别、MBTI、身高体重、外貌 |
| L2 | 人格层 | 缓慢校准 | Big Five（N/A/O/C/E），初始随机，每次 ±0.1~0.3 |
| L3 | 关系层 | 动态，每回合 | trust / security / closeness / neediness / possessiveness |
| L4 | 记忆层 | 累积 | revealedFacts / sessionSummaries / emotionalMemories |

### L2 大五人格（0-100）

| 维度 | Key | 高分表现 | 低分表现 |
|------|-----|----------|----------|
| 神经质 | neuroticism | 情绪化、敏感、焦虑 | 稳定、冷静、抗压 |
| 宜人性 | agreeableness | 体贴、迁就、共情 | 独立、直率、自我保护 |
| 开放性 | openness | 好奇、想象、尝试 | 现实、稳定、谨慎 |
| 尽责性 | conscientiousness | 计划、承诺、担忧 | 随性、灵活、不太在意 |
| 外向性 | extraversion | 主动、热情、话多 | 内向、安静、独处充电 |

### L3 关系维度（0-100，积分制）

| 维度 | Key | 初始值 | 含义 |
|------|-----|--------|------|
| 信任感 | trust | 30 | 觉得你靠不靠谱 |
| 安全感 | security | 30 | 觉得不会被抛弃 |
| 亲密感 | closeness | 20 | 情感亲近程度 |
| 依恋度 | neediness | 20 | 多想和你待一起 |
| 占有欲 | possessiveness | 10 | 对你和别人的敏感度 |

分档：0-20 冰点 / 21-40 低 / 41-60 中 / 61-80 高 / 81-100 满

### 三阶段调制

```
effective_Δ = raw_Δ_enum × l2_factor × mood_factor
```

- **raw_Δ_enum**：LLM 选择枚举值（major_decrease(-10) / minor_decrease(-3) / neutral(0) / minor_increase(+3) / major_increase(+10)）
- **l2_factor**：Big Five 人格调制（0.5x ~ 1.5x）
- **mood_factor**：压力调制（正面 Δ 减弱，负面 Δ 增强）

### 压力系统（0-100）

- 独立短期状态，不属于关系维度
- 自然衰减：base 3 + 神经质影响 + 尽责性影响
- 通过 mood_factor 放大负面变化、削弱正面变化

### 开场策略

角色生成后随机选择（不和性格挂钩）：

| 策略 | 行为 | 坍缩方式 |
|------|------|----------|
| 纯情绪（emotion） | 角色碎碎念 | 用户自由接话，首次提及坍缩 |
| 薛定谔（schrodinger） | 角色问「你在干嘛？」 | 用户回答触发坍缩 |
| 观测者（observer） | 不发开场白 | 用户先说话触发坍缩 |

### 记忆系统

- **revealedFacts** — 角色已暴露的个人信息
  - `setting` 类型：不可变（地点、职业、外貌特征）
  - `experience` 类型：可修订（经历、感受），保留修改历史
- **sessionSummaries** — 最近 5 次 session 摘要（LLM 生成）
- **recentContext** — 最近 10 条对话记录（5 轮完整上下文，修复"鱼的记忆"问题）
- **emotionalMemories** — 长期情绪记忆

### 世界观同步

- **天气**：基于 wttr.in 查询，15 分钟缓存，依赖位置坍缩
- **节日**：16 个固定节日 + 4 个农历节日
- **时间**：7 个时段 + 精确小时，强制 Asia/Shanghai 时区，角色自然感知
- **位置**：量子态，首次提到城市时坍缩

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
  "reasoning": "CoT 分析过程",
  "stateDelta": {
    "trust": "minor_increase",
    "security": "neutral",
    "closeness": "major_increase",
    "neediness": "minor_increase",
    "possessiveness": "neutral"
  },
  "stressDelta": "minor_decrease",
  "shortTermUpdate": { ... },
  "memoryUpdate": { ... }
}
```

## 游戏化

- **好感度** — 0-1000，6 个等级：陌生→认识→友好→亲密→心动→恋人
  - 正常互动递增（每日聊天+5，语音+10，照片+15，深入对话+20）
  - 负面 delta 扣除（major_decrease×2→-30，negative×3→-15，major_decrease×1→-8）
- **成就** — 18 个（互动/语音/图片/关系/时间/收集类）
- **每日任务** — 早安/晚安/分享心情/语音/照片/深入对话
- **收集** — 照片集/语音集/回忆录/成就墙

## 依赖

| 依赖 | 用途 | 来源 |
|------|------|------|
| Hermes Agent | 运行环境，工具链 | [hermes-agent](https://hermes-agent.nousresearch.com) |
| mimo-v2-5-tts | 语音合成（voice design + clone） | [XiaomiMiMo/MiMo-Skills](https://github.com/XiaomiMiMo/MiMo-Skills) |
| image-api | 图片生成与编辑（gpt-image-2） | [harrylarryxyz/image-api](https://github.com/harrylarryxyz/image-api) |
| mood-sticker | 表情包搜索（tangdouz API，免费） | [clawhub.ai/chensanle/sticker](https://clawhub.ai/chensanle/sticker) |
| ffmpeg | 语音格式转码（wav→ogg） | 系统包 |

## License

MIT
