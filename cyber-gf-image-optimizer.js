/**
 * CyberPersona 图片文件管理器
 * 功能：记录、索引、查询所有生成的图片文件
 */

const fs = require('fs');
const path = require('path');

/**
 * 图片文件管理器
 */
class ImageFileManager {
  constructor(dataDir) {
    this.dataDir = dataDir || path.join(process.cwd(), '.data');
    this.indexPath = path.join(this.dataDir, 'image-index.json');
    this.index = this.loadIndex();
  }

  /**
   * 加载图片索引
   */
  loadIndex() {
    try {
      if (fs.existsSync(this.indexPath)) {
        return JSON.parse(fs.readFileSync(this.indexPath, 'utf8'));
      }
    } catch (err) {
      console.error('[image-manager] Failed to load index:', err.message);
    }
    return { images: [], nextId: 1 };
  }

  /**
   * 保存图片索引
   */
  saveIndex() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2));
    } catch (err) {
      console.error('[image-manager] Failed to save index:', err.message);
    }
  }

  /**
   * 记录一张新生成的图片
   * @param {object} imageResult - { filename, filepath, size }
   * @param {object} meta - { scene, type, prompt, isReference }
   */
  recordImage(imageResult, meta = {}) {
    const entry = {
      id: this.index.nextId++,
      filename: imageResult.filename || '',
      filepath: imageResult.filepath || '',
      size: imageResult.size || 0,
      scene: meta.scene || 'unknown',
      type: meta.type || 'generate', // 'generate' or 'edit'
      prompt: meta.prompt || '',
      isReference: !!meta.isReference,
      createdAt: new Date().toISOString()
    };

    this.index.images.push(entry);
    this.saveIndex();
    return entry;
  }

  /**
   * 获取最近 N 张图片
   */
  getRecent(count = 10) {
    return this.index.images.slice(-count);
  }

  /**
   * 按场景查询图片
   */
  getByScene(scene) {
    return this.index.images.filter(img => img.scene === scene);
  }

  /**
   * 按类型查询
   */
  getByType(type) {
    return this.index.images.filter(img => img.type === type);
  }

  /**
   * 获取参考照片
   */
  getReferencePhotos() {
    return this.index.images.filter(img => img.isReference);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const images = this.index.images;
    const scenes = {};
    const types = {};
    let totalSize = 0;

    for (const img of images) {
      scenes[img.scene] = (scenes[img.scene] || 0) + 1;
      types[img.type] = (types[img.type] || 0) + 1;
      totalSize += img.size || 0;
    }

    return {
      total: images.length,
      totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      scenes,
      types,
      referencePhotos: images.filter(i => i.isReference).length
    };
  }

  /**
   * 清理不存在的文件记录
   */
  cleanStaleEntries() {
    const before = this.index.images.length;
    this.index.images = this.index.images.filter(img => {
      if (!img.filepath) return false;
      return fs.existsSync(img.filepath);
    });
    const removed = before - this.index.images.length;
    if (removed > 0) this.saveIndex();
    return { removed, remaining: this.index.images.length };
  }
}

/**
 * 创建图片文件管理器实例
 */
function createImageFileManager(dataDir) {
  return new ImageFileManager(dataDir);
}

module.exports = {
  ImageFileManager,
  createImageFileManager
};
