const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getConfig } = require('./cyber-gf-config');

const IMAGE_SCRIPT = path.resolve(process.env.HOME || '/root', '.hermes/skills/image-api/scripts/image_api.py');

function getImageOutputDir() {
  const config = getConfig();
  return config.imageOutputDir || path.resolve(process.cwd(), 'img-cyber-gf');
}

function ensureOutputDir() {
  const dir = getImageOutputDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Generate an image via the image-api skill script.
 * @param {string} prompt - Image generation prompt (Chinese or English)
 * @param {object} [options]
 * @param {string} [options.size='1024x1024'] - Image size
 * @param {string} [options.quality='low'] - Image quality (low/medium/high)
 * @returns {Promise<{filename: string, filepath: string, size: number}>}
 */
function generateImage(prompt, options = {}) {
  return new Promise((resolve, reject) => {
    const size = options.size || '1024x1024';
    const quality = options.quality || 'low';

    const args = [
      IMAGE_SCRIPT,
      '--json',
      prompt,
      '--size', size,
      '--quality', quality,
      '--format', 'png',
      '--moderation', 'low'
    ];

    try {
      const result = execFileSync('python3', args, {
        timeout: 180000,
        encoding: 'utf8',
        env: {
          ...process.env,
          IMAGE_OUT_DIR: getImageOutputDir()
        }
      });

      const json = JSON.parse(result.trim());
      if (!json.ok) {
        reject(new Error(json.error || 'Image generation failed'));
        return;
      }

      const imgPath = json.paths?.[0];
      if (!imgPath) {
        reject(new Error('No image path returned'));
        return;
      }

      const filename = path.basename(imgPath);
      const sizeBytes = fs.statSync(imgPath).size;

      resolve({
        filename,
        filepath: imgPath,
        size: sizeBytes
      });
    } catch (err) {
      reject(new Error(`Image generation error: ${err.message}`));
    }
  });
}

/**
 * Generate image with retry.
 */
async function generateImageWithRetry(prompt, options = {}, attempts = 2) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await generateImage(prompt, options);
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  throw lastError;
}

/**
 * Edit an existing image via the image-api skill script (edits endpoint).
 * Used for character consistency: edits a reference photo to match a new scene.
 * @param {string} prompt - Edit description (English)
 * @param {string} imagePath - Path to the base image (reference photo)
 * @param {object} [options]
 * @param {string} [options.size='1024x1024'] - Image size
 * @returns {Promise<{filename: string, filepath: string, size: number}>}
 */
function editImage(prompt, imagePath, options = {}) {
  return new Promise((resolve, reject) => {
    const size = options.size || '1024x1024';

    const args = [
      IMAGE_SCRIPT,
      '--json',
      '--edit',
      '--image', imagePath,
      prompt,
      '--size', size,
      '--format', 'png',
      '--moderation', 'low'
    ];

    try {
      const result = execFileSync('python3', args, {
        timeout: 180000,
        encoding: 'utf8',
        env: {
          ...process.env,
          IMAGE_OUT_DIR: getImageOutputDir()
        }
      });

      const json = JSON.parse(result.trim());
      if (!json.ok) {
        reject(new Error(json.error || 'Image edit failed'));
        return;
      }

      const imgPath = json.paths?.[0];
      if (!imgPath) {
        reject(new Error('No image path returned from edit'));
        return;
      }

      const filename = path.basename(imgPath);
      const sizeBytes = fs.statSync(imgPath).size;

      resolve({
        filename,
        filepath: imgPath,
        size: sizeBytes
      });
    } catch (err) {
      reject(new Error(`Image edit error: ${err.message}`));
    }
  });
}

/**
 * Edit image with retry.
 */
async function editImageWithRetry(prompt, imagePath, options = {}, attempts = 2) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await editImage(prompt, imagePath, options);
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  throw lastError;
}

module.exports = {
  generateImage,
  generateImageWithRetry,
  editImage,
  editImageWithRetry,
  getImageOutputDir,
  ensureOutputDir
};
