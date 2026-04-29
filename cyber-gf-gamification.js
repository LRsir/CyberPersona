/**
 * CyberPersona 游戏化元素模块
 * 功能：成就系统、好感度系统、每日任务、收集系统
 */

/**
 * 成就系统配置
 */
const ACHIEVEMENTS = {
  // 互动类成就
  first_conversation: {
    id: 'first_conversation',
    name: '初次对话',
    description: '完成第一次对话',
    icon: '💬',
    condition: (state) => (state.meta?.turnCount || 0) >= 1,
    reward: { trust: 'slight_up' },
    rarity: 'common'
  },
  ten_conversations: {
    id: 'ten_conversations',
    name: '话匣子',
    description: '完成10次对话',
    icon: '🗣️',
    condition: (state) => (state.meta?.turnCount || 0) >= 10,
    reward: { warmth: 'slight_up' },
    rarity: 'common'
  },
  hundred_conversations: {
    id: 'hundred_conversations',
    name: '知心人',
    description: '完成100次对话',
    icon: '💝',
    condition: (state) => (state.meta?.turnCount || 0) >= 100,
    reward: { trust: 'slight_up', warmth: 'slight_up' },
    rarity: 'rare'
  },
  
  // 语音类成就
  first_voice: {
    id: 'first_voice',
    name: '声音初遇',
    description: '第一次发送语音',
    icon: '🎤',
    condition: (state) => state.shortTermState?.recentVoicePattern !== 'none',
    reward: { voiceEase: 'slight_up' },
    rarity: 'common'
  },
  voice_master: {
    id: 'voice_master',
    name: '语音达人',
    description: '发送10次语音',
    icon: '🎵',
    condition: (state) => (state.runtimeCache?.voiceCount || 0) >= 10,
    reward: { voiceEase: 'slight_up' },
    rarity: 'uncommon'
  },
  
  // 图片类成就
  first_selfie: {
    id: 'first_selfie',
    name: '初次见面',
    description: '收到第一张自拍',
    icon: '📸',
    condition: (state) => state.shortTermState?.recentImagePattern === 'selfie',
    reward: { approachDesire: 'slight_up' },
    rarity: 'common'
  },
  photo_collector: {
    id: 'photo_collector',
    name: '收藏家',
    description: '收到10张照片',
    icon: '🖼️',
    condition: (state) => (state.runtimeCache?.imageCount || 0) >= 10,
    reward: { approachDesire: 'slight_up' },
    rarity: 'uncommon'
  },
  
  // 关系类成就
  first_heartbeat: {
    id: 'first_heartbeat',
    name: '心动瞬间',
    description: '第一次心跳加速',
    icon: '💓',
    condition: (state) => state.dynamicState?.relationshipWarmth === 'high',
    reward: { warmth: 'slight_up' },
    rarity: 'uncommon'
  },
  trust_fall: {
    id: 'trust_fall',
    name: '信任坠落',
    description: '信任度达到最高',
    icon: '🤝',
    condition: (state) => state.dynamicState?.trust === 'high',
    reward: { trust: 'slight_up', safety: 'slight_up' },
    rarity: 'rare'
  },
  soulmate: {
    id: 'soulmate',
    name: '灵魂伴侣',
    description: '所有关系指标达到最高',
    icon: '💑',
    condition: (state) => {
      const ds = state.dynamicState;
      return ds?.relationshipWarmth === 'high' &&
             ds?.trust === 'high' &&
             ds?.safety === 'high' &&
             ds?.approachDesire === 'high' &&
             ds?.vulnerabilityWillingness === 'high';
    },
    reward: { all: 'slight_up' },
    rarity: 'legendary'
  },
  
  // 时间类成就
  one_week: {
    id: 'one_week',
    name: '一周纪念',
    description: '关系持续7天',
    icon: '📅',
    condition: (state) => {
      const createdAt = state.meta?.createdAt;
      if (!createdAt) return false;
      const days = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return days >= 7;
    },
    reward: { warmth: 'slight_up' },
    rarity: 'common'
  },
  one_month: {
    id: 'one_month',
    name: '月度纪念',
    description: '关系持续30天',
    icon: '🗓️',
    condition: (state) => {
      const createdAt = state.meta?.createdAt;
      if (!createdAt) return false;
      const days = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return days >= 30;
    },
    reward: { trust: 'slight_up', warmth: 'slight_up' },
    rarity: 'uncommon'
  },
  one_year: {
    id: 'one_year',
    name: '周年纪念',
    description: '关系持续365天',
    icon: '🎂',
    condition: (state) => {
      const createdAt = state.meta?.createdAt;
      if (!createdAt) return false;
      const days = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return days >= 365;
    },
    reward: { all: 'slight_up' },
    rarity: 'epic'
  },
  
  // 特殊成就
  night_owl: {
    id: 'night_owl',
    name: '夜猫子',
    description: '在凌晨2-5点聊天',
    icon: '🦉',
    condition: (state) => state.runtimeCache?.lateNightChat === true,
    reward: { intimacy: 'slight_up' },
    rarity: 'uncommon'
  },
  early_bird: {
    id: 'early_bird',
    name: '早起鸟',
    description: '在早上6-7点聊天',
    icon: '🐦',
    condition: (state) => state.runtimeCache?.earlyMorningChat === true,
    reward: { warmth: 'slight_up' },
    rarity: 'uncommon'
  },
  all_night: {
    id: 'all_night',
    name: '彻夜长谈',
    description: '连续聊天超过4小时',
    icon: '🌙',
    condition: (state) => state.runtimeCache?.longChatSession === true,
    reward: { trust: 'slight_up', warmth: 'slight_up' },
    rarity: 'rare'
  },
  
  // 收集类成就
  nickname_collector: {
    id: 'nickname_collector',
    name: '昵称收集者',
    description: '拥有3个不同的昵称',
    icon: '📛',
    condition: (state) => {
      const nicknames = new Set();
      if (state.revealedMemory?.nicknameForUser) nicknames.add(state.revealedMemory.nicknameForUser);
      if (state.revealedMemory?.nicknameForSelf) nicknames.add(state.revealedMemory.nicknameForSelf);
      return nicknames.size >= 3;
    },
    reward: { approachDesire: 'slight_up' },
    rarity: 'uncommon'
  },
  memory_keeper: {
    id: 'memory_keeper',
    name: '记忆守护者',
    description: '记录10个重要事件',
    icon: '📚',
    condition: (state) => (state.revealedMemory?.importantEvents?.length || 0) >= 10,
    reward: { trust: 'slight_up' },
    rarity: 'rare'
  }
};

/**
 * 好感度系统配置
 */
const AFFECTION_SYSTEM = {
  levels: [
    { name: '陌生', min: 0, max: 100, icon: '😐' },
    { name: '认识', min: 101, max: 300, icon: '🙂' },
    { name: '友好', min: 301, max: 500, icon: '😊' },
    { name: '亲密', min: 501, max: 700, icon: '😄' },
    { name: '心动', min: 701, max: 900, icon: '🥰' },
    { name: '恋人', min: 901, max: 1000, icon: '💕' }
  ],
  
  // 好感度获取方式
  gainMethods: {
    daily_chat: { points: 5, description: '每日聊天' },
    voice_message: { points: 10, description: '发送语音' },
    photo_share: { points: 15, description: '分享照片' },
    deep_conversation: { points: 20, description: '深入对话' },
    emotional_support: { points: 25, description: '情感支持' },
    special_event: { points: 30, description: '特殊事件' },
    achievement_unlock: { points: 50, description: '解锁成就' }
  },
  
  // 好感度消耗
  lossMethods: {
    long_absence: { points: -10, description: '长时间未互动' },
    rude_behavior: { points: -20, description: '粗鲁行为' },
    broken_promise: { points: -30, description: '违背承诺' }
  }
};

/**
 * 每日任务配置
 */
const DAILY_TASKS = {
  morning_greeting: {
    id: 'morning_greeting',
    name: '早安问候',
    description: '发送早安消息',
    icon: '🌅',
    reward: { affection: 5, points: 10 },
    resetTime: '00:00',
    condition: (state, history) => {
      const today = new Date().toDateString();
      return history.some(h => 
        h.type === 'morning_greeting' && 
        new Date(h.timestamp).toDateString() === today
      );
    }
  },
  evening_greeting: {
    id: 'evening_greeting',
    name: '晚安问候',
    description: '发送晚安消息',
    icon: '🌙',
    reward: { affection: 5, points: 10 },
    resetTime: '00:00',
    condition: (state, history) => {
      const today = new Date().toDateString();
      return history.some(h => 
        h.type === 'evening_greeting' && 
        new Date(h.timestamp).toDateString() === today
      );
    }
  },
  share_feeling: {
    id: 'share_feeling',
    name: '分享心情',
    description: '分享今天的心情',
    icon: '💭',
    reward: { affection: 10, points: 20 },
    resetTime: '00:00',
    condition: (state, history) => {
      const today = new Date().toDateString();
      return history.some(h => 
        h.type === 'share_feeling' && 
        new Date(h.timestamp).toDateString() === today
      );
    }
  },
  voice_chat: {
    id: 'voice_chat',
    name: '语音聊天',
    description: '发送语音消息',
    icon: '🎤',
    reward: { affection: 15, points: 30 },
    resetTime: '00:00',
    condition: (state, history) => {
      const today = new Date().toDateString();
      return history.some(h => 
        h.type === 'voice_message' && 
        new Date(h.timestamp).toDateString() === today
      );
    }
  },
  photo_share: {
    id: 'photo_share',
    name: '照片分享',
    description: '分享一张照片',
    icon: '📸',
    reward: { affection: 20, points: 40 },
    resetTime: '00:00',
    condition: (state, history) => {
      const today = new Date().toDateString();
      return history.some(h => 
        h.type === 'photo_share' && 
        new Date(h.timestamp).toDateString() === today
      );
    }
  },
  deep_talk: {
    id: 'deep_talk',
    name: '深入对话',
    description: '进行一次深入对话',
    icon: '💬',
    reward: { affection: 25, points: 50 },
    resetTime: '00:00',
    condition: (state, history) => {
      const today = new Date().toDateString();
      return history.some(h => 
        h.type === 'deep_conversation' && 
        new Date(h.timestamp).toDateString() === today
      );
    }
  }
};

/**
 * 收集系统配置
 */
const COLLECTION_SYSTEM = {
  categories: {
    photos: {
      name: '照片集',
      icon: '📷',
      items: [
        { id: 'selfie_1', name: '第一张自拍', rarity: 'common' },
        { id: 'food_1', name: '第一张美食', rarity: 'common' },
        { id: 'scenery_1', name: '第一张风景', rarity: 'common' },
        { id: 'outfit_1', name: '第一张穿搭', rarity: 'uncommon' },
        { id: 'pet_1', name: '第一张宠物', rarity: 'uncommon' },
        { id: 'night_1', name: '夜景照片', rarity: 'rare' },
        { id: 'rainy_1', name: '雨天照片', rarity: 'rare' }
      ]
    },
    voices: {
      name: '语音集',
      icon: '🎵',
      items: [
        { id: 'voice_hello', name: '第一次打招呼', rarity: 'common' },
        { id: 'voice_goodnight', name: '第一次晚安', rarity: 'common' },
        { id: 'voice_miss_you', name: '第一次说想你', rarity: 'uncommon' },
        { id: 'voice_love_you', name: '第一次说我爱你', rarity: 'rare' },
        { id: 'voice_whisper', name: '耳边私语', rarity: 'rare' },
        { id: 'voice_sing', name: '唱歌给你听', rarity: 'epic' }
      ]
    },
    memories: {
      name: '回忆录',
      icon: '📖',
      items: [
        { id: 'first_meeting', name: '初次相遇', rarity: 'common' },
        { id: 'first_date', name: '第一次约会', rarity: 'uncommon' },
        { id: 'first_quarrel', name: '第一次吵架', rarity: 'uncommon' },
        { id: 'first_reconciliation', name: '第一次和好', rarity: 'uncommon' },
        { id: 'first_anniversary', name: '第一个纪念日', rarity: 'rare' },
        { id: 'first_trip', name: '第一次旅行', rarity: 'rare' },
        { id: 'first_promise', name: '第一次承诺', rarity: 'epic' }
      ]
    },
    achievements: {
      name: '成就墙',
      icon: '🏆',
      items: Object.values(ACHIEVEMENTS).map(a => ({
        id: a.id,
        name: a.name,
        rarity: a.rarity
      }))
    }
  }
};

/**
 * 成就管理器
 */
class AchievementManager {
  constructor(state) {
    this.state = state;
    this.unlockedAchievements = state.runtimeCache?.achievements || [];
    this.achievementHistory = [];
  }
  
  /**
   * 检查并解锁成就
   */
  checkAndUnlock() {
    const newAchievements = [];
    
    for (const [id, achievement] of Object.entries(ACHIEVEMENTS)) {
      // 跳过已解锁的
      if (this.unlockedAchievements.includes(id)) continue;
      
      // 检查条件
      if (achievement.condition(this.state)) {
        this.unlockedAchievements.push(id);
        newAchievements.push(achievement);
        
        // 记录历史
        this.achievementHistory.push({
          id,
          name: achievement.name,
          unlockedAt: new Date().toISOString(),
          rarity: achievement.rarity
        });
      }
    }
    
    // 更新状态
    if (!this.state.runtimeCache) this.state.runtimeCache = {};
    this.state.runtimeCache.achievements = this.unlockedAchievements;
    
    return newAchievements;
  }
  
  /**
   * 获取已解锁成就
   */
  getUnlockedAchievements() {
    return this.unlockedAchievements.map(id => ({
      id,
      ...ACHIEVEMENTS[id]
    }));
  }
  
  /**
   * 获取成就进度
   */
  getAchievementProgress() {
    const total = Object.keys(ACHIEVEMENTS).length;
    const unlocked = this.unlockedAchievements.length;
    
    return {
      total,
      unlocked,
      percentage: Math.round((unlocked / total) * 100)
    };
  }
  
  /**
   * 获取稀有成就统计
   */
  getRarityStats() {
    const stats = {
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 0,
      legendary: 0
    };
    
    for (const id of this.unlockedAchievements) {
      const achievement = ACHIEVEMENTS[id];
      if (achievement) {
        stats[achievement.rarity]++;
      }
    }
    
    return stats;
  }
}

/**
 * 好感度管理器
 */
class AffectionManager {
  constructor(state) {
    this.state = state;
    this.affectionPoints = state.runtimeCache?.affectionPoints || 0;
    this.affectionHistory = [];
  }
  
  /**
   * 添加好感度
   */
  addAffection(method, amount = null) {
    const gainConfig = AFFECTION_SYSTEM.gainMethods[method];
    if (!gainConfig && !amount) return this.affectionPoints;
    
    const points = amount || gainConfig.points;
    this.affectionPoints = Math.min(1000, this.affectionPoints + points);
    
    // 记录历史
    this.affectionHistory.push({
      method,
      points,
      timestamp: new Date().toISOString(),
      total: this.affectionPoints
    });
    
    // 更新状态
    if (!this.state.runtimeCache) this.state.runtimeCache = {};
    this.state.runtimeCache.affectionPoints = this.affectionPoints;
    
    return this.affectionPoints;
  }
  
  /**
   * 减少好感度
   */
  reduceAffection(method, amount = null) {
    const lossConfig = AFFECTION_SYSTEM.lossMethods[method];
    if (!lossConfig && !amount) return this.affectionPoints;
    
    const points = amount || lossConfig.points;
    this.affectionPoints = Math.max(0, this.affectionPoints + points);
    
    // 记录历史
    this.affectionHistory.push({
      method,
      points,
      timestamp: new Date().toISOString(),
      total: this.affectionPoints
    });
    
    // 更新状态
    if (!this.state.runtimeCache) this.state.runtimeCache = {};
    this.state.runtimeCache.affectionPoints = this.affectionPoints;
    
    return this.affectionPoints;
  }
  
  /**
   * 获取当前好感度等级
   */
  getCurrentLevel() {
    for (const level of AFFECTION_SYSTEM.levels) {
      if (this.affectionPoints >= level.min && this.affectionPoints <= level.max) {
        return {
          ...level,
          points: this.affectionPoints,
          progress: Math.round(((this.affectionPoints - level.min) / (level.max - level.min)) * 100)
        };
      }
    }
    
    return AFFECTION_SYSTEM.levels[0];
  }
  
  /**
   * 获取好感度历史
   */
  getHistory(days = 7) {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - days);
    
    return this.affectionHistory.filter(h => 
      new Date(h.timestamp) >= threshold
    );
  }
  
  /**
   * 获取好感度统计
   */
  getStats() {
    const level = this.getCurrentLevel();
    const totalGained = this.affectionHistory
      .filter(h => h.points > 0)
      .reduce((sum, h) => sum + h.points, 0);
    const totalLost = this.affectionHistory
      .filter(h => h.points < 0)
      .reduce((sum, h) => sum + Math.abs(h.points), 0);
    
    return {
      current: this.affectionPoints,
      level,
      totalGained,
      totalLost,
      netChange: totalGained - totalLost
    };
  }
}

/**
 * 每日任务管理器
 */
class DailyTaskManager {
  constructor(state) {
    this.state = state;
    this.completedTasks = state.runtimeCache?.dailyTasks || {};
    this.taskHistory = [];
  }
  
  /**
   * 检查并完成任务
   */
  checkAndComplete(taskId, history = []) {
    const task = DAILY_TASKS[taskId];
    if (!task) return null;
    
    // 检查是否已完成
    const today = new Date().toDateString();
    if (this.completedTasks[taskId] === today) {
      return { completed: false, reason: 'already_completed' };
    }
    
    // 检查条件
    if (task.condition(this.state, history)) {
      this.completedTasks[taskId] = today;
      
      // 记录历史
      this.taskHistory.push({
        id: taskId,
        name: task.name,
        completedAt: new Date().toISOString(),
        reward: task.reward
      });
      
      // 更新状态
      if (!this.state.runtimeCache) this.state.runtimeCache = {};
      this.state.runtimeCache.dailyTasks = this.completedTasks;
      
      return {
        completed: true,
        task,
        reward: task.reward
      };
    }
    
    return { completed: false, reason: 'condition_not_met' };
  }
  
  /**
   * 获取今日任务状态
   */
  getTodayTasks() {
    const today = new Date().toDateString();
    
    return Object.entries(DAILY_TASKS).map(([id, task]) => ({
      id,
      name: task.name,
      description: task.description,
      icon: task.icon,
      reward: task.reward,
      completed: this.completedTasks[id] === today
    }));
  }
  
  /**
   * 获取任务完成统计
   */
  getCompletionStats() {
    const today = new Date().toDateString();
    const todayCompleted = Object.values(this.completedTasks)
      .filter(date => date === today).length;
    
    const totalTasks = Object.keys(DAILY_TASKS).length;
    
    return {
      todayCompleted,
      totalTasks,
      completionRate: Math.round((todayCompleted / totalTasks) * 100)
    };
  }
}

/**
 * 收集系统管理器
 */
class CollectionManager {
  constructor(state) {
    this.state = state;
    this.collections = state.runtimeCache?.collections || {
      photos: [],
      voices: [],
      memories: [],
      achievements: []
    };
  }
  
  /**
   * 添加收集品
   */
  addItem(category, itemId) {
    if (!this.collections[category]) {
      this.collections[category] = [];
    }
    
    // 检查是否已收集
    if (this.collections[category].includes(itemId)) {
      return { collected: false, reason: 'already_collected' };
    }
    
    this.collections[category].push(itemId);
    
    // 更新状态
    if (!this.state.runtimeCache) this.state.runtimeCache = {};
    this.state.runtimeCache.collections = this.collections;
    
    return {
      collected: true,
      category,
      itemId
    };
  }
  
  /**
   * 获取收集进度
   */
  getCollectionProgress() {
    const progress = {};
    
    for (const [category, config] of Object.entries(COLLECTION_SYSTEM.categories)) {
      const collected = this.collections[category]?.length || 0;
      const total = config.items.length;
      
      progress[category] = {
        name: config.name,
        icon: config.icon,
        collected,
        total,
        percentage: Math.round((collected / total) * 100)
      };
    }
    
    return progress;
  }
  
  /**
   * 获取稀有度统计
   */
  getRarityStats() {
    const stats = {
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 0,
      legendary: 0
    };
    
    for (const [category, items] of Object.entries(this.collections)) {
      for (const itemId of items) {
        const categoryConfig = COLLECTION_SYSTEM.categories[category];
        const item = categoryConfig?.items.find(i => i.id === itemId);
        if (item) {
          stats[item.rarity]++;
        }
      }
    }
    
    return stats;
  }
  
  /**
   * 获取收集建议
   */
  getCollectionSuggestions() {
    const suggestions = [];
    
    for (const [category, config] of Object.entries(COLLECTION_SYSTEM.categories)) {
      const collected = this.collections[category] || [];
      const missing = config.items.filter(item => !collected.includes(item.id));
      
      if (missing.length > 0) {
        suggestions.push({
          category,
          categoryName: config.name,
          missingItems: missing.slice(0, 3).map(item => item.name)
        });
      }
    }
    
    return suggestions;
  }
}

/**
 * 创建游戏化系统
 */
function createGamificationSystem(state) {
  const achievementManager = new AchievementManager(state);
  const affectionManager = new AffectionManager(state);
  const dailyTaskManager = new DailyTaskManager(state);
  const collectionManager = new CollectionManager(state);
  
  return {
    achievementManager,
    affectionManager,
    dailyTaskManager,
    collectionManager,
    
    /**
     * 检查所有游戏化元素
     */
    checkAll(history = []) {
      const results = {
        achievements: achievementManager.checkAndUnlock(),
        tasks: dailyTaskManager.getTodayTasks(),
        affection: affectionManager.getCurrentLevel(),
        collections: collectionManager.getCollectionProgress()
      };
      
      return results;
    },
    
    /**
     * 记录互动并更新游戏化元素
     */
    recordInteraction(type, details = {}) {
      // 更新好感度
      if (AFFECTION_SYSTEM.gainMethods[type]) {
        affectionManager.addAffection(type);
      }
      
      // 检查任务完成
      dailyTaskManager.checkAndComplete(type, details.history || []);
      
      // 检查成就解锁
      achievementManager.checkAndUnlock();
      
      return {
        affection: affectionManager.getCurrentLevel(),
        achievements: achievementManager.getAchievementProgress()
      };
    },
    
    /**
     * 获取游戏化状态
     */
    getStatus() {
      return {
        achievements: {
          unlocked: achievementManager.getUnlockedAchievements(),
          progress: achievementManager.getAchievementProgress(),
          rarityStats: achievementManager.getRarityStats()
        },
        affection: {
          current: affectionManager.getCurrentLevel(),
          stats: affectionManager.getStats()
        },
        dailyTasks: {
          today: dailyTaskManager.getTodayTasks(),
          stats: dailyTaskManager.getCompletionStats()
        },
        collections: {
          progress: collectionManager.getCollectionProgress(),
          rarityStats: collectionManager.getRarityStats(),
          suggestions: collectionManager.getCollectionSuggestions()
        }
      };
    },
    
    /**
     * 更新状态
     */
    updateState(newState) {
      this.state = newState;
      achievementManager.state = newState;
      affectionManager.state = newState;
      dailyTaskManager.state = newState;
      collectionManager.state = newState;
    }
  };
}

module.exports = {
  ACHIEVEMENTS,
  AFFECTION_SYSTEM,
  DAILY_TASKS,
  COLLECTION_SYSTEM,
  AchievementManager,
  AffectionManager,
  DailyTaskManager,
  CollectionManager,
  createGamificationSystem
};
