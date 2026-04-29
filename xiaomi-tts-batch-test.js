#!/usr/bin/env node
/**
 * Xiaomi TTS 批量音色测试脚本
 * 一次性生成所有内置音色的同一段文本语音
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  baseUrl: process.env.XIAOMI_BASE_URL || 'https://your-mimo-base-url.example/v1',
  apiKey: process.env.XIAOMI_API_KEY || 'sk-123',
  text: '你好，我是小虾米，一个机灵的小跟班。很高兴认识你！',
  outputDir: '/root/.openclaw/workspace/tts-batch-output'
};

// 音色列表（英文名 + 中文名映射）
const VOICES = [
  { id: 'mimo_default', name: 'MiMo默认', lang: 'auto' },
  { id: 'default_zh', name: '默认中文', lang: 'zh' },
  { id: 'default_en', name: '默认英文', lang: 'en' },
  { id: 'Mia', name: 'Mia', lang: 'en' },
  { id: 'Chloe', name: 'Chloe', lang: 'en' },
  { id: 'Milo', name: 'Milo', lang: 'en' },
  { id: 'Dean', name: 'Dean', lang: 'en' }
];

// 风格变体（同一段文本的不同风格）
const STYLES = [
  { name: 'normal', style: '' },
  { name: 'gentle', style: '温柔、舒缓，像睡前讲故事一样' },
  { name: 'excited', style: '轻快、兴奋，带着好消息的激动' },
  { name: 'lazy', style: '慵懒、随意，刚睡醒的感觉' }
];

// 创建输出目录
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

// 解析 URL
function parseUrl(url) {
  const parsed = new URL(url);
  return {
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path: parsed.pathname + parsed.search
  };
}

// 发送 TTS 请求
function sendTTSRequest(voice, style, index) {
  return new Promise((resolve, reject) => {
    const urlInfo = parseUrl(CONFIG.baseUrl);
    const client = urlInfo.protocol === 'https:' ? https : http;
    
    const messages = [];
    // 只有当 style 有实际内容时才添加 user message
    if (style.style && style.style.trim()) {
      messages.push({
        role: 'user',
        content: style.style.trim()
      });
    }
    messages.push({
      role: 'assistant',
      content: CONFIG.text
    });
    
    const payload = {
      model: 'mimo-v2.5-tts',
      messages: messages,
      audio: {
        format: 'mp3',
        voice: voice.id
      }
    };
    
    const postData = JSON.stringify(payload);
    
    const options = {
      hostname: urlInfo.hostname,
      port: urlInfo.port,
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': CONFIG.apiKey,
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          // 检查错误响应
          if (response.detail) {
            console.log(`❌ Error: ${JSON.stringify(response.detail).substring(0, 200)}`);
            reject(new Error(`API error for ${voice.name}/${style.name}: ${JSON.stringify(response.detail).substring(0, 200)}`));
            return;
          }
          
          // 尝试多种可能的 audio 数据路径
          let audioData = null;
          
          if (response.choices && response.choices[0]) {
            const choice = response.choices[0];
            if (choice.message && choice.message.audio && choice.message.audio.data) {
              audioData = choice.message.audio.data;
            } else if (choice.audio && choice.audio.data) {
              audioData = choice.audio.data;
            }
          }
          
          if (!audioData && response.audio && response.audio.data) {
            audioData = response.audio.data;
          }
          
          if (audioData) {
            const buffer = Buffer.from(audioData, 'base64');
            
            const filename = `${String(index).padStart(2, '0')}_${voice.id}_${style.name}.mp3`;
            const filepath = path.join(CONFIG.outputDir, filename);
            
            fs.writeFileSync(filepath, buffer);
            resolve({
              voice: voice.name,
              style: style.name,
              filename: filename,
              size: buffer.length,
              success: true
            });
          } else {
            console.error('Debug - response keys:', Object.keys(response));
            reject(new Error(`No audio data in response for ${voice.name}/${style.name}`));
          }
        } catch (err) {
          reject(new Error(`Parse error for ${voice.name}/${style.name}: ${err.message}`));
        }
      });
    });
    
    req.on('error', (err) => {
      reject(new Error(`Request error for ${voice.name}/${style.name}: ${err.message}`));
    });
    
    req.write(postData);
    req.end();
  });
}

// 主函数
async function main() {
  console.log('🎙️ Xiaomi TTS 批量音色测试');
  console.log('========================');
  console.log(`文本: "${CONFIG.text}"`);
  console.log(`音色数: ${VOICES.length}`);
  console.log(`风格数: ${STYLES.length}`);
  console.log(`预计生成: ${VOICES.length * STYLES.length} 个音频文件`);
  console.log(`输出目录: ${CONFIG.outputDir}`);
  console.log('========================\n');
  
  const results = [];
  let index = 1;
  
  for (const voice of VOICES) {
    for (const style of STYLES) {
      process.stdout.write(`生成中: ${voice.name} + ${style.name} ... `);
      
      try {
        const result = await sendTTSRequest(voice, style, index);
        results.push(result);
        console.log(`✅ ${result.filename} (${(result.size / 1024).toFixed(1)} KB)`);
      } catch (err) {
        results.push({
          voice: voice.name,
          style: style.name,
          error: err.message,
          success: false
        });
        console.log(`❌ ${err.message}`);
      }
      
      index++;
      
      // 限流，避免触发速率限制
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  
  // 生成报告
  console.log('\n========================');
  console.log('📊 生成报告');
  console.log('========================');
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  console.log(`成功: ${successCount}`);
  console.log(`失败: ${failCount}`);
  
  // 按音色分组输出
  console.log('\n📁 文件列表:');
  for (const voice of VOICES) {
    console.log(`\n${voice.name} (${voice.id}):`);
    const voiceResults = results.filter(r => r.voice === voice.name);
    for (const r of voiceResults) {
      if (r.success) {
        console.log(`  ✅ ${r.style}: ${r.filename}`);
      } else {
        console.log(`  ❌ ${r.style}: ${r.error}`);
      }
    }
  }
  
  // 保存 JSON 报告
  const reportPath = path.join(CONFIG.outputDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    config: {
      text: CONFIG.text,
      baseUrl: CONFIG.baseUrl
    },
    summary: {
      total: results.length,
      success: successCount,
      fail: failCount
    },
    results: results
  }, null, 2));
  
  console.log(`\n📄 详细报告已保存: ${reportPath}`);
}

main().catch(console.error);
