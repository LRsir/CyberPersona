# Changelog

## v8.1.2 (2026-04-30)

### 性能优化

#### 第一次"开始赛博女友"流程优化
- 精简第三步：删除介绍照片和介绍声音的生成
- 样本声音直接作为介绍声音
- 证件照直接作为介绍照片
- 节省时间：25-200秒

#### 新流程
1. **第一步：生成完整人设信息**（LLM 推理，60-120秒）
2. **第二步：并行生成三个产物**
   - 输出人物信息卡片（文字）
   - 使用声音描述生成样本声音
   - 使用外貌描述生成证件照
3. **第三步：应用 start payload**
4. **第四步：输出角色介绍**

---

## v8.1.1 (2026-04-30)

### 新增

- 新增 SKILL.md 到项目根目录，供 Hermes Agent 使用
- 清理敏感信息：移除硬编码路径、API keys
- 更新 README.md：添加安装 skill 的步骤

---

## v8.1.0 (2026-04-30)

### 新增功能

#### Cheat 模式
- 新增 `cheat on/off` 命令，控制信息展示开关
- 开启时显示：回合小结、聊天建议、详细退出总结
- 关闭时只发送角色回复，保持沉浸感
- 支持 `开始赛博女友 cheat on` 启动时开启
- 退出后自动重置为关闭状态

#### Debug 模式升级
- 统一命令格式：`debug on/off`、`debug <功能> <参数>`
- 新增状态查看：`debug 状态` — 展示维度、情绪、记忆、游戏化
- 新增记忆查看：`debug 记忆` — 展示所有记忆内容
- 新增状态修改：`debug 设置 <维度> <值>` — 快速调整关系维度
- 新增场景模拟：`debug 场景 <场景名>` — 模拟特定场景测试
- 增强调试信息：`debug 发语音/发照片/发表情` 显示实际参数

#### 信息展示规范
- 开始信息：上次回顾 + 当前关系状态（cheat 开启时）
- 回合小结：状态变化 + 情绪转变 + 动态评价 + 聊天建议（cheat 开启时）
- 退出总结：完整 session 统计 + 对话评价 + 记忆更新（cheat 开启时）
- 数据来源原则：所有数字必须从系统实际数据读取

### 改进

- 移除 tool_progress 自动控制，改为用户手动管理
- 沉浸感规则：发送语音时不重复发送文字消息
- 统一 agent 行为，避免自由发挥导致的不一致

### 命令对照表

| 功能 | 命令 |
|------|------|
| 开始 | `开始赛博女友` |
| 开始（cheat） | `开始赛博女友 cheat on` |
| 退出 | `退出赛博女友` |
| Cheat 开/关 | `cheat on` / `cheat off` |
| Debug 开/关 | `debug on` / `debug off` |
| 查看状态 | `debug 状态` |
| 查看记忆 | `debug 记忆` |
| 修改维度 | `debug 设置 trust 80` |
| 模拟场景 | `debug 场景 被夸奖` |
| 测试语音 | `debug 发语音 晚安` |
| 测试图片 | `debug 发照片` |
| 测试贴纸 | `debug 发表情 害羞` |

---

## v8.0.0 (2026-04-30)

### 重大变更

- 动态状态：6 维度积分制（0-100）替代旧的低/中/高系统
- 情绪深度：emotionHistory、emotionalProfile、emotionalMemories、moodFactors
- 记忆系统：sessionSummaries（跨 session 记忆，最近 5 次）
- TurnResultPayload：移除 `taggedTtsText`/`naturalStylePrompt`，新增 `sendGifNow`/`gifKeyword`
- 表情包：通过 mood-sticker skill（tangdouz API）
- Prompt 全面重写，上下文驱动推理（非规则引擎）

### 架构变更

- 7 个 JS 模块（移除 9 个未使用模块）
- 图片重构：弃用 cyber-gf-image.js，agent 直接调用 image-api
- TTS 重构：弃用 cyber-gf-tts.js，agent 直接调用 mimo-tts
- 项目从 ~/CyberPersona 迁移到 ~/.hermes/CyberPersona-hermes

---

## v7.0.0 (2026-04-29)

- 初始版本
- 基础角色扮演功能
- 语音、图片、表情包支持
- 游戏化系统
