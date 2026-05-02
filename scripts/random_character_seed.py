#!/usr/bin/env python3
"""随机角色种子生成器 v3 - 纯视觉标签版

创世阶段只生成三类字段：
1. systemBase: Big Five + personalityArchetype（决定思维方式）
2. appearance: 外貌锚点 — 纯视觉标签（决定图片生成）
3. voice: 声音锚点（决定 TTS）

量子态原则：只给轴不定点。
- 不写具体数值（155cm）
- 不写习惯动作（喜欢穿/常扎）
- 不写主观评价（看谁都像在放电）
- 不写动态表情（笑起来有酒窝）
所有视觉描述降维为可直接喂给生图模型的 Tags。
"""
import random
import json

# ─── 外貌特征（纯视觉标签）──────────────────────────
hair_styles = [
    "黑色长直发",
    "黑色齐肩内扣短发",
    "棕色自然波浪卷",
    "高马尾",
    "双马尾",
    "栗色清爽短发",
    "银灰色渐变短发",
    "浅棕色齐刘海",
    "红色挑染侧马尾",
    "自然卷蓬松短发",
    "深紫色酷飒短发",
    "亚麻色中长发",
]

skin_features = [
    "白皙皮肤，脸颊有淡淡雀斑",
    "健康小麦色皮肤",
    "暖肤色",
    "冷白皮",
    "细腻素颜肌肤",
    "深色皮肤",
]

eye_features = [
    "灵动大眼睛，双眼皮",
    "韵味丹凤眼",
    "清澈圆眼",
    "戴圆框眼镜",
    "细长桃花眼",
    "透亮杏眼",
    "戴黑框眼镜",
    "有神单眼皮",
    "眼角有泪痣",
]

# 证件照拍摄时的穿搭（不代表日常习惯）
photo_outfits = [
    "Oversized卫衣",
    "精致连衣裙",
    "干练白衬衫",
    "JK制服",
    "T恤与牛仔外套",
    "暗黑哥特风服饰",
    "运动背心",
    "复古花衬衫",
    "工装外套",
    "温柔针织衫",
    "极简黑白灰穿搭",
]

body_types = [
    "高挑纤细",
    "娇小玲珑",
    "匀称适中",
    "微胖婴儿肥",
    "修长运动型",
    "小巧骨架",
    "丰满曲线型",
    "偏瘦且锁骨明显",
]

# ─── 声音描述（严格遵循 mimo-tts voicedesign 规范）────────
voice_styles = [
    "20多岁女性，声音偏低沉，胸腔共鸣为主，语速偏慢，吐字松弛慵懒，底色温软。",
    "20多岁女性，声音清亮偏高，头腔共鸣明显，语速适中，吐字轻快利落，底色明朗。",
    "20多岁女性，声音轻柔带气声，语速偏慢，吐字含蓄收敛，底色温软害羞。",
    "20多岁女性，声线偏中性，胸腔共鸣，语速适中，吐字干脆不拖沓，底色冷静克制。",
    "20多岁女性，声音甜润明亮，口腔共鸣为主，语速偏快，吐字活泼跳跃，底色元气。",
    "20多岁女性，声音温厚沉稳，胸腔共鸣，语速偏慢，吐字从容有分量，底色安定。",
    "20多岁女性，声线略带沙哑质感，气声混合实声，语速适中，吐字不紧不慢，底色漫不经心。",
    "20多岁女性，声音清冷空灵，头腔共鸣，语速偏慢，吐字疏离克制，底色淡然。",
    "20多岁女性，声音偏细软，鼻音稍重，语速偏快，吐字轻飘跳跃，底色天真。",
    "20多岁女性，声线醇厚带磁性，胸腔共鸣明显，语速适中，吐字稳重有力度，底色从容。",
    "20多岁女性，声音干涩偏薄，气息短促，语速忽快忽慢，吐字带顿挫感，底色敏感警觉。",
    "20多岁女性，声音温润如玉，口腔与鼻腔混合共鸣，语速适中，吐字圆润柔和，底色平和。",
]

# ─── 大五人格原型（16 种）────────────────────────
big_five_archetypes = [
    {"label": "高敏感艺术家型", "n": 75, "a": 55, "o": 80, "c": 40, "e": 35},
    {"label": "温柔治愈型",     "n": 35, "a": 80, "o": 55, "c": 65, "e": 50},
    {"label": "元气开朗型",     "n": 25, "a": 65, "o": 70, "c": 50, "e": 80},
    {"label": "高冷毒舌型",     "n": 45, "a": 25, "o": 45, "c": 70, "e": 25},
    {"label": "傲娇别扭型",     "n": 65, "a": 35, "o": 50, "c": 55, "e": 40},
    {"label": "成熟稳重型",     "n": 20, "a": 60, "o": 50, "c": 85, "e": 45},
    {"label": "粘人小太阳型",   "n": 55, "a": 75, "o": 65, "c": 40, "e": 85},
    {"label": "独立飒爽型",     "n": 25, "a": 45, "o": 70, "c": 75, "e": 55},
    {"label": "文艺敏感型",     "n": 70, "a": 50, "o": 90, "c": 35, "e": 20},
    {"label": "话痨社交型",     "n": 30, "a": 70, "o": 60, "c": 40, "e": 90},
    {"label": "强势大女主型",   "n": 25, "a": 35, "o": 70, "c": 85, "e": 80},
    {"label": "极客宅女型",     "n": 50, "a": 45, "o": 85, "c": 30, "e": 25},
    {"label": "传统贤惠型",     "n": 45, "a": 85, "o": 35, "c": 80, "e": 40},
    {"label": "疯批美人型",     "n": 85, "a": 40, "o": 75, "c": 20, "e": 85},
    {"label": "潇洒冒险型",     "n": 20, "a": 60, "o": 90, "c": 35, "e": 85},
    {"label": "冰山禁欲型",     "n": 40, "a": 20, "o": 45, "c": 90, "e": 15},
]

# ─── 开场策略 ──────────────────────────────────
opening_strategies = ["emotion", "schrodinger", "observer"]


def _float_value(base, delta=5):
    return max(0, min(100, base + random.randint(-delta, delta)))


def generate_seed():
    archetype = random.choice(big_five_archetypes)

    seed = {
        "personalityArchetype": archetype["label"],
        "bigFive": {
            "o": _float_value(archetype["o"]),
            "c": _float_value(archetype["c"]),
            "e": _float_value(archetype["e"]),
            "a": _float_value(archetype["a"]),
            "n": _float_value(archetype["n"]),
        },
        "openingStrategy": random.choice(opening_strategies),
        "appearance": {
            "hair": random.choice(hair_styles),
            "skin": random.choice(skin_features),
            "eye": random.choice(eye_features),
            "photoOutfit": random.choice(photo_outfits),
            "bodyType": random.choice(body_types),
        },
        "voiceStyle": random.choice(voice_styles),
        "seedId": random.randint(10000, 99999),
    }
    return seed


if __name__ == "__main__":
    seed = generate_seed()
    print(json.dumps(seed, ensure_ascii=False, indent=2))
