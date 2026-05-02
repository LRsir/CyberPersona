# Changelog

## v10.4.0 (2026-05-03)

### SKILL.md 精简重写

- 731 行 → 183 行，删除所有项目介绍性内容
- 只保留 agent 操作需要的内容：命令、Turn 流程、JSON 模板、投递细节、Pitfalls
- 删除：四层架构理论、Big Five 说明、调制公式、Stress 系统理论、State Narrative、游戏化细节、Debug 输出格式、Character Response Guidelines
- 这些内容属于 README 和代码注释，不属于 SKILL.md

---

## v10.3.0 (2026-05-03)

### Turn 流程 v2.0 规范化重构

#### 新增 `scripts/build-turn-prompt.js`
- 模块一：上下文构建，替代 `get-turn-prompt.js`（旧脚本保留向后兼容）
- 通过 `npm run build-turn-prompt "消息"` 调用

#### 重写 `scripts/apply-turn-result.js`
- 模块三：校验与结算
- **分级容错**：JSON 解析失败→兜底台词、stateDelta 逐字段独立校验、visibleText 能用就用不能用兜底
- **useReferencePhoto 自动处理**：`true` 时自动追加人物一致性指令到 imagePrompt
- 通过 `npm run apply-turn-result` 调用

#### 新增 JSON 模板字段
- `imageWaitText`：生图过渡台词（LLM 根据角色性格生成）
- `imageFailedText`：生图失败找补台词（LLM 根据角色性格生成）
- `useReferencePhoto`：true=改图模式（有角色出镜），false=普通生图

#### 校验改进
- stateDelta 从 all-or-nothing 改为逐字段独立校验（错误字段→neutral，其余保留）
- stressDelta 同样独立校验
- 枚举三重保险：prompt 文本 + JSON 模板 + 代码校验

#### 投递规范化
- 快慢分流：语音同步（60s 超时降级）、图片异步（delegate_task 子 agent）
- 投递顺序：语音/文字 → 贴纸 → imageWaitText → 图片
- imageWaitText 独立于 visibleText，不拼接

#### 文档更新
- SKILL.md：重写 Full Turn Cycle 为 4 模块架构，版本升级至 v10.3.0
- package.json：版本升级至 v10.3.0，新增 `build-turn-prompt` 命令

## v10.1.2 (2026-05-02)

### 标准化 Turn 流程脚本

#### 新增 `scripts/run-turn.js` (已废弃，v10.3.0 移除)
- 一键运行完整 turn 流程，已被 `build-turn-prompt.js` + `apply-turn-result.js` 替代

#### 新增 `scripts/verify-turn-flow.js` (已废弃，v10.3.0 移除)
- 验证 turn 流程，已无必要保留

#### 文档更新
- SKILL.md：新增标准化 turn 流程文档
- README.md：新增「对话流程」章节
- package.json：新增脚本命令（v10.3.0 已清理）

#### 解决的问题
- 消除手动拼接 turn 流程的错误（跳过 buildTurnContextPayload、手动更新状态等）
- 确保所有用户都走完整的 turn 流程
- 为验证流程可行性提供标准化工具

---

## v10.1.1 (2026-05-02)

### 标准化初始化脚本

#### 新增 `scripts/init-cyber-persona.js`
- 一键初始化：运行种子脚本 → 应用状态 → 输出结果
- 可通过 `npm run init` 或 `node scripts/init-cyber-persona.js` 调用
- 结果写入 `/tmp/cyber-gf-init-result.json` 供后续流程使用

#### 文档更新
- SKILL.md：更新初始化流程文档，删除旧版 LLM 生成流程
- README.md：新增「快速开始」章节，推荐使用标准化脚本
- package.json：新增 `init` 脚本命令

#### 解决的问题
- 消除手动拼接 node -e 命令的转义问题
- 消除 /tmp JS 文件的路径问题
- 为其他用户提供标准化的初始化入口

---

## v10.1.0 (2026-05-02)

### 初始化流程去 LLM 化

#### 种子脚本 v5（random_character_seed.py）
- 新增开场白台词库：5 种策略 × 15 条预设台词（共 75 条）
- 种子脚本直接输出 `openingMessage`，无需 LLM 生成
- 量子态原则：台词不提及任何具体个人信息

#### 删除的字段和函数
- 删除 `signatureLine`（签名语）— 不值得一次 LLM 调用
- 删除 `emotionalProfile` — 违背量子态原则，与 Big Five 重复
- 删除 `buildInitialProfileAgentPrompt()` — 不再需要 LLM 初始化调用
- `buildInitialState(seed)` 不再需要 `llmOutput` 参数

#### 效果
- 初始化时间从 ~7s 降到 ~4s（省掉一次 LLM API 调用）
- 初始化流程：种子脚本 → 并行生成证件照+语音样本 → 发送
- 零 LLM 开销完成角色创建

---

## v10.0.0 (2026-05-02)

### 角色卡系统 — 数据结构与初始化生命周期

#### 角色信息模板（characterCard）
- 新增 `characterCard` 作为角色数据的唯一数据源
- 创世阶段（脚本生成）：`systemBase`（Big Five + archetype）、`appearance`（含 bodyType）、`voice`
- ~~初始化阶段（LLM 生成）：`signatureLine`（签名语）~~ → v10.1.0 删除
- 量子态字段：`identity`、`physicalTraits`、`personalitySelfDescription`、`preferences`、`innerWorld`、`habits`、`memories`
- 所有量子态字段使用动态键值对（Dynamic KV），不再预设固定插槽
- 版本迁移：v2→v3 自动迁移，从旧 profile/revealedMemory 映射到 characterCard

#### Revision 机制
- `identity`、`physicalTraits`、`innerWorld` 三个分类支持历史版本
- 值变更时旧值压入 `_revisions` 数组（最多保留 5 条）
- 其他分类（habits、preferences 等）直接覆盖

#### 种子脚本重构（random_character_seed.py v3）
- **移除** `age`、`profession`、`hobbies` 的随机生成（还给量子态）
- **新增** `bodyType` 外貌字段（身材特征，对文生图至关重要）
- **新增** Big Five ±5 随机浮动机制（同原型也有个体差异）
- **扩充** 人格原型池至 16 种（新增：强势大女主、极客宅女、传统贤惠、疯批美人、潇洒冒险、冰山禁欲）

#### 成就系统
- 新增 `CARD_DEFINITIONS`：6 张角色卡定义（身份/外形/性格/喜好/心事/习惯）
- 新增 `checkCardProgress(characterCard)`：检测解锁进度
- 每类收集 3 项信息即解锁对应卡片
- memories 特殊处理：events + milestones + gifts 总和计数

#### 初始化流程简化
- ~~`buildInitialProfileAgentPrompt` 大幅简化：LLM 只需生成 `signatureLine` + `openingMessage` + `emotionalProfile.baseline`~~ → v10.1.0 全部删除
- 种子数据作为上下文传入 prompt，LLM 不再重复生成外貌/声音/性格
- ~~`buildInitialState(seed, llmOutput)` 从种子直接填充 characterCard~~ → v10.1.0 简化为 `buildInitialState(seed)`
- `buildStartPayload(seedData)` 接受种子数据参数

#### 回合系统适配
- turn 输出新增 `characterCardUpdate` 字段
- `applyTurnResult` 自动处理 characterCard 更新
- 旧版 `memoryUpdate` 字段自动同步到 characterCard（兼容过渡期）
- `getCardFlatValues()` 剥离 revision 元数据，用于 prompt 上下文

## v9.3.0 (2026-05-01)

### 量子态完善

#### speechHabits 量子态
- 种子脚本 `random_character_seed.py`：移除 `speechHabits` 字段生成
- 初始 prompt：添加 speechHabits 量子态警告（不在创建时设定）
- 回合 prompt：添加 `【说话习惯 — 量子态】` 段落，指导 LLM 自然展现并记录
- 状态模块 `cyber-gf-state.js`：添加 `speechHabitsAdd` 处理逻辑（首次坍缩）
- 验证模块 `cyber-gf-turn.js`：添加 `speechHabitsAdd` 验证和 fallback

#### quirks 量子态
- 种子脚本 `random_character_seed.py`：移除 `quirks` 字段生成
- 初始 prompt：添加 quirks 量子态警告（不在创建时设定）
- 回合 prompt：添加 `【小怪癖 — 量子态】` 段落，指导 LLM 自然展现并记录
- 状态模块 `cyber-gf-state.js`：添加 `quirksAdd` 处理逻辑（首次坍缩，去重）
- 验证模块 `cyber-gf-turn.js`：添加 `quirksAdd` 验证和 fallback

#### Big Five 排序标准化
- 种子脚本：bigFive 字段从 N/A/O/C/E 改为 OCEAN 顺序
- 初始 prompt：personalitySettings JSON 和说明文字改为 OCEAN 顺序

#### 关系初始值人格化
- 档案模块 `cyber-gf-profile.js`：新增 `computeInitialDynamicState(personalitySettings)` 函数
- 根据 Big Five 计算初始关系值：
  - trust: 20 + A×0.3 + C×0.2（高信任倾向+高尽责 → 更信任）
  - security: 50 - N×0.3（低情绪波动 → 更有安全感）
  - closeness: 5 + E×0.25 + O×0.15（高外向+高开放 → 更亲近）
  - neediness: 10 + N×0.2 + (100-E)×0.15（高情绪波动+低外向 → 更需要陪伴）
  - possessiveness: 5 + N×0.15 + (100-A)×0.15（高情绪波动+低信任倾向 → 更强占有欲）
- `resolveInitialProfilePayload`：检测 LLM 是否使用默认值，若是则用计算值覆盖

---

## v9.2.0 (2026-05-01)

### 强化

#### 量子态代码层硬约束
- `cyber-gf-profile.js`：`validateInitialProfile` 新增量子态强制校验
  - `revealedFacts` / `emotionalMemories` / `importantEvents` 非空 → 拒绝整个 payload
  - 错误信息：`Quantum State Violation: 必须为空数组，留给后续对话坍缩`
- `cyber-gf-controller.js`：`applyInitialStatePayload` 新增双重保险
  - validator 通过后，代码层仍强制清空三个记忆数组
  - 物理隔离 LLM "丰满人设"冲动导致的量子态泄漏

#### 时区修复
- `cyber-gf-state.js`：`getTimeOfDay()` 强制使用 `Asia/Shanghai` 时区
  - 修复服务器在海外时角色时间感知错误的问题
  - 确保"凌晨3点 → 你怎么还不睡"的自然反应

#### 上下文窗口扩展
- `cyber-gf-controller.js`：`recentContext` 从 3 条扩展到 10 条
  - `getRecentContext(limit=10)` + `slice(-10)`
  - 修复"鱼的记忆"问题：角色现在能记住 5 轮前自己抛的梗

#### 状态版本迁移
- `cyber-gf-state.js`：`createEmptyState` 版本号 1→2
- `cyber-gf-state.js`：`repairState` 新增 v1→v2 自动迁移逻辑
  - 移除废弃的 `voiceTendency`
  - 重命名 `intimacy→closeness`、`attachment→neediness`、`jealousy→possessiveness`
  - 确保 `personalitySettings` 和 `stress` 字段存在
  - 未来版本变更时可复用此迁移框架

---

## v9.1.1 (2026-05-01)

### 修复

#### L2 乘数二次叠加（数值爆炸风险）
- `cyber-gf-state.js`：neediness 和 possessiveness 的 L2 因子计算中，neuroticism (N) 被重复计入 `baseFactor` 和内部公式
- 修复前：N=90 时 neediness 乘数 = 1.89（二次方放大）
- 修复后：N=90 时 neediness 乘数 = 1.26（线性，N 仅在 baseFactor 中）

#### CoT 强制校验缺失
- `cyber-gf-turn.js`：`analysis` 字段未列入必填校验，LLM 可跳过思考链直接输出 delta
- 修复：`analysis` 加入 `requiredStringFields`，缺失则拒绝 turn 结果

#### 量子态泄漏
- `cyber-gf-prompts.js`：初始 prompt 的 `revealedMemoryInit` 模板未明确禁止预设事实
- 修复：JSON 模板加 ⚠️ 注释 + prompt 正文加显式禁令，锁死空数组

#### 好感度与状态脱钩
- `cyber-gf-gamification.js`：好感度仅按互动类型递增，不考虑 stateDelta 正负
- 修复：新增负面 delta 扣除逻辑
  - `major_decrease ≥ 2 维度` → -30（关系崩塌）
  - `negative ≥ 3 维度` → -15（关系冲突）
  - `major_decrease ≥ 1 维度` → -8（关系受挫）
- `cyber-gf-controller.js`：`recordInteraction` 调用传入 `stateDelta`

### 脱敏

- `SKILL.md`：3 处 `/root/` 硬编码路径替换为 `~/` 通用路径

---

## v9.1.0 (2026-05-01)

### 新增功能

#### 三种开场策略
- **策略1 纯情绪开场（emotion）**：角色碎碎念，不坍缩任何位置，用户自由接话
- **策略2 薛定谔提问（schrodinger）**：角色问「你在干嘛？」触发用户回答坍缩
- **策略3 观测者模式（observer）**：不发开场白，显示"她正在在线..."，用户先说话坍缩
- 随机选择，不和性格挂钩（防止用户反推性格）
- 策略 1 和 2：LLM 只拿到 L2+Stress，prompt 禁止提及地点/天气/动作
- 种子脚本新增 `openingStrategy` 字段

#### revealedFacts 类型分类
- `setting` 类型：不可变（地点、职业、外貌特征），一旦坍缩不覆盖
- `experience` 类型：可修订（经历、感受），保留修改历史（lastRevision）
- LLM 上下文注入格式区分：setting 无标记，experience 显示 `[可修订]`

### 代码变更

- `scripts/random_character_seed.py`：删除 opening_scenes 池，新增 openingStrategy 随机选择
- `cyber-gf-prompts.js`：buildInitialAgentPrompt 支持三种策略参数，纯情绪策略禁止坍缩
- `cyber-gf-controller.js`：开场逻辑根据策略分支，observer 策略跳过 LLM 调用
- `cyber-gf-state.js`：mergeRevealedFacts 支持 type 分类 + setting 不可变 + experience 修订历史

---

## v9.0.0 (2026-05-01)

### 重大变更

#### 大五人格替代自定义 L2 参数
- 删除：extraversion / agreeableness / openness / expressiveness / adventurousness / emotionalStability / empathy
- 新增：neuroticism / agreeableness / openness / conscientiousness / extraversion
- 心理学理论支撑，不再是自创维度
- 依恋风格（attachmentStyle）不再作为独立 L2，其行为模式被 N（焦虑）和低 A（回避）吸收

#### 5 维度 L3 替代旧 6 维度
| 旧维度 | 新维度 | 变化 |
|--------|--------|------|
| trust | trust | 保留 |
| security | security | 保留 |
| intimacy | closeness | 重命名 |
| attachment | neediness | 重命名，更准确 |
| jealousy | possessiveness | 重命名 |
| voiceTendency | — | 删除，功能并入 closeness |

#### 三阶段调制系统
- `effective_Δ = raw_Δ_enum × l2_factor × mood_factor`
- L2 调制：N 影响所有幅度+压力敏感度，A 影响信任+冲突，O 影响新奇事件，C 影响承诺事件，E 仅影响行为
- Mood 调制：正面 Δ ×(1-0.5×stress/100)，负面 Δ ×(1+0.5×stress/100)

#### 枚举化 delta（防 LLM 数值幻觉）
- `major_decrease(-10)` / `minor_decrease(-3)` / `neutral(0)` / `minor_increase(+3)` / `major_increase(+10)`
- LLM 必须先写 CoT 分析，再选枚举值
- 代码层做 ENUM_TO_INT 转换 + 算术

#### 压力系统
- 独立短期状态，不属于 L3（关系维度）
- 范围 0-100，自然衰减：base 3 + N 影响 + C 影响
- 通过 mood_factor 影响所有 L3 变化

#### State Narrative Translation
- buildStateNarrative()：数字 → 自然语言（"信任感：82/100 — 她很信赖你"）
- dimToText / stressToText / l2ToText：每个维度/压力/L2 都有自然语言映射
- thresholdToText：阈值触发的自然语言描述

### 代码变更

- `cyber-gf-state.js`：dynamicState 重构，ENUM_TO_INT，getL2Factor，getMoodFactor，decayStress
- `cyber-gf-prompts.js`：全面重写，buildStateNarrative，枚举 delta + CoT
- `cyber-gf-turn.js`：stateDelta 改为枚举验证，新增 stressDelta
- `cyber-gf-profile.js`：STARTING_RANGES 更新，validateInitialProfile 支持 personalitySettings
- `cyber-gf-controller.js`：slimProfile 更新，debug 显示更新
- `cyber-gf-gamification.js`：维度名称更新
- `scripts/random_character_seed.py`：Big Five archetypes，删除 vulnerabilities/emotionExpressions/openingScenes 池

---

## v8.5.0 (2026-05-01)

### 量子态清理

#### 删除所有预设行为模板
- 删除 `vulnerabilities` 池：脆弱话题不再预设，由 LLM 在 trust>60 时自然生成
- 删除 `emotionExpressions` 池：情绪表达方式不再预设，初始化为空，首次情感体验时坍缩
- 删除 `stateBehavior` 矩阵：行为由 LLM 根据上下文推理
- 删除 `temporalMoodTemplates`：时间情绪不再预设
- 删除 `openingScenes` 池（在 v9.1.0 中完成）

#### 量子态原则
- 种子只给「轴」不给「点」：职业=nurse → 方向，不是描述
- 没提及 = 无限可能，提及 = 立刻坍缩
- 角色通过对话「长出」自己，不被种子定义

---

## v8.4.0 (2026-05-01)

### 世界观同步

#### 天气感知
- 基于 wttr.in curl 查询，15 分钟缓存
- 依赖 `revealedMemory.locations.current`（量子态）
- 位置未坍缩时：不注入天气，LLM 不编造
- 位置坍缩后：根据实际天气注入上下文

#### 节日感知
- `.data/holidays.json`：16 个固定节日 + 4 个农历节日
- 特殊日期自动注入上下文

#### 时间感知增强
- 7 个时间段：凌晨(0-5) / 早晨(6-8) / 上午(9-11) / 中午(12-13) / 下午(14-17) / 傍晚(18-19) / 晚上(20-23)
- 精确小时注入
- 角色自然感知时间（凌晨3点：「你怎么还不睡？」）

#### 位置量子态
- Profile 不预设位置（量子态原则）
- 首次提到城市 → 坍缩到 `revealedMemory.locations.current`
- 旅行 → `locations.current` 暂时改变，返回后恢复
- 返回由 LLM 自然决定，不用定时器

### 新增文件

- `.data/holidays.json` — 节日数据
- `.data/world-cache.json` — 天气缓存

---

## v8.3.0 (2026-05-01)

### 依赖更新

#### image-api 独立化
- `image-api` 已独立为通用开源项目：[harrylarryxyz/image-api](https://github.com/harrylarryxyz/image-api)
- 支持任意 OpenAI 兼容图片生成 provider（不再绑定特定服务）
- 新增功能：`url` 响应格式支持、内容类型检查（HTML 错误页面检测）、主备双端点自动切换
- 零依赖（Python stdlib + curl）
- README.md、SKILL.md 更新安装指南和依赖链接

### 游戏化系统升级

- 情绪深度集成：维度变化触发成就检查
- 情绪记忆里程碑：首次特定情绪触发收集成就
- 关系阶段解锁：冰点→日常→亲密→深度，不同阶段解锁不同内容

---

## v8.2.0 (2026-05-01)

### 新增功能

#### 角色多样性系统
- 新增 `scripts/random_character_seed.py` 随机角色种子生成器
- 每次生成新角色前运行，确保角色差异化
- 12 个特征池，覆盖性格/外貌/职业/爱好/声音/说话习惯/依恋风格/情绪表达/怪癖/脆弱话题/开场场景

#### 新增 4 个人格维度
- **说话习惯 (speechHabits)**：14 种 — 语气词、emoji、标点、口头禅等文字表达习惯
- **依恋风格 (attachmentStyle)**：5 种 — 安全型/焦虑型/回避型/恐惧型/讨好型，附带 stateBehavior 指导关系推进
- **情绪表达习惯 (emotionExpression)**：害羞/开心/生气/低落/吃醋 各 4 种个性化表达方式
- **小怪癖 (quirks)**：20 种 — 让角色有记忆点的独特习惯

#### Voice Description 规范化
- voice_styles 池子重写为 mimo-tts voicedesign 规范格式
- 必写四要素：身份锚点(年龄+性别) + 声音质感 + 语速节奏 + 情绪底色
- 禁止抽象比喻（"像深夜电台"），使用可感知描述（"胸腔共鸣""气声"）
- InitialStatePayload prompt 中加入 voicedesign 硬约束

### 修复

#### 消息投递防重复
- 修复 sendVoiceNow=false 时文字同时出现在 send_message 和最终回复的 bug
- 明确投递规则：visibleText 只能出现在一个地方
- sendVoiceNow=true → 语音替代文字，最终回复不写文字
- sendVoiceNow=false → 文字只在最终回复中，不用 send_message 发

### 代码变更

- `cyber-gf-prompts.js`：buildInitialProfileAgentPrompt 加新字段 + voicedesign 约束；buildTurnAgentPrompt 上下文加入新维度
- `cyber-gf-controller.js`：buildTurnContextPayload 的 slimProfile 传递新字段
- `cyber-persona SKILL.md`：加入随机种子步骤、voicedesign 规范、投递规则、新字段说明

---

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
