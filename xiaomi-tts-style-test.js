#!/usr/bin/env node
/**
 * Xiaomi TTS 风格标签测试脚本
 * 直接调 API，验证音频标签是否被正确解析
 *
 * 注意：这是实验脚本，包含大量非正式链路标签（方言/唱歌/角色扮演/导演式标签）。
 * 当前正式链路不直接采用这些测试结果作为推荐写法。
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  baseUrl: process.env.XIAOMI_BASE_URL || 'https://your-mimo-base-url.example/v1',
  apiKey: process.env.XIAOMI_API_KEY || 'sk-123',
  outputDir: '/root/.openclaw/workspace/tts-style-test'
};

// 测试用例：带各种风格标签的文本
const TEST_CASES = [
  {
    name: '基础风格标签',
    text: '(温柔)今晚的风很轻，像有人在耳边轻轻叹气。'
  },
  {
    name: '情绪切换',
    text: '(开心)今天终于周五了！(悲伤)可是明天还要加班……'
  },
  {
    name: '方言测试',
    text: '(东北话)哎呀妈呀，这天儿也忒冷了吧！'
  },
  {
    name: '唱歌模式',
    text: '(唱歌)原谅我这一生不羁放纵爱自由'
  },
  {
    name: '细粒度标签-呼吸',
    text: '（紧张，深呼吸）呼……冷静，冷静。不就是一个面试吗。'
  },
  {
    name: '细粒度标签-颤抖',
    text: '如果我当时……（颤抖）哪怕再坚持一秒钟……'
  },
  {
    name: '多风格混合',
    text: '(磁性)夜已经深了，城市还在呼吸。（慵懒）我是今晚陪你的人……'
  },
  {
    name: '角色扮演',
    text: '(孙悟空)俺老孙来也！'
  },
  {
    name: '导演模式-简单版',
    text: '(温柔、舒缓，像睡前讲故事一样)小狐狸蜷在老橡树的树洞里，尾巴盖住了鼻尖。'
  },
  {
    name: '无标签对照组',
    text: '小狐狸蜷在老橡树的树洞里，尾巴盖住了鼻尖。'
  }
];

// 创建输出目录
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

function sendTTSRequest(testCase, index) {
  return new Promise((resolve, reject) => {
    const payload = {
      model: 'mimo-v2.5-tts',
      messages: [
        {
          role: 'assistant',
          content: testCase.text
        }
      ],
      audio: {
        format: 'mp3',
        voice: 'mimo_default'
      }
    };

    const postData = JSON.stringify(payload);
    
    const options = {
      hostname: 'fufu.iqach.top',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': CONFIG.apiKey,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.detail) {
            reject(new Error(`API error: ${JSON.stringify(response.detail)}`));
            return;
          }

          const audioData = response.choices?.[0]?.message?.audio?.data;
          if (!audioData) {
            reject(new Error('No audio data in response'));
            return;
          }

          const buffer = Buffer.from(audioData, 'base64');
          const filename = `${String(index).padStart(2, '0')}_${testCase.name}.mp3`;
          const filepath = path.join(CONFIG.outputDir, filename);
          
          fs.writeFileSync(filepath, buffer);
          
          resolve({
            name: testCase.name,
            text: testCase.text,
            filename: filename,
            size: buffer.length,
            success: true
          });
        } catch (err) {
          reject(new Error(`Parse error: ${err.message}`));
        }
      });
    });

    req.on('error', err => reject(new Error(`Request error: ${err.message}`)));
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('🎙️ Xiaomi TTS 风格标签测试');
  console.log('========================');
  console.log(`测试用例数: ${TEST_CASES.length}`);
  console.log(`输出目录: ${CONFIG.outputDir}`);
  console.log('========================\n');

  const results = [];
  
  for (let i = 0; i < TEST_CASES.length; i++) {
    const testCase = TEST_CASES[i];
    process.stdout.write(`[${i + 1}/${TEST_CASES.length}] ${testCase.name} ... `);
    
    try {
      const result = await sendTTSRequest(testCase, i + 1);
      results.push(result);
      console.log(`✅ ${result.filename} (${(result.size / 1024).toFixed(1)} KB)`);
    } catch (err) {
      results.push({
        name: testCase.name,
        text: testCase.text,
        error: err.message,
        success: false
      });
      console.log(`❌ ${err.message}`);
    }
    
    // 间隔 2 秒，避免限流
    if (i < TEST_CASES.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // 生成报告
  console.log('\n========================');
  console.log('📊 测试报告');
  console.log('========================');
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  console.log(`成功: ${successCount}/${TEST_CASES.length}`);
  console.log(`失败: ${failCount}/${TEST_CASES.length}`);
  
  console.log('\n📁 生成文件:');
  for (const r of results) {
    if (r.success) {
      console.log(`  ✅ ${r.filename}`);
      console.log(`     标签: ${r.text.substring(0, 60)}${r.text.length > 60 ? '...' : ''}`);
    } else {
      console.log(`  ❌ ${r.name}: ${r.error}`);
    }
  }

  // 保存 JSON 报告
  const reportPath = path.join(CONFIG.outputDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total: TEST_CASES.length,
      success: successCount,
      fail: failCount
    },
    results: results
  }, null, 2));
  
  console.log(`\n📄 报告已保存: ${reportPath}`);
  console.log('\n💡 下一步:');
  console.log('   把生成的 MP3 文件发给你试听');
  console.log('   确认哪些标签被正确解析，哪些被当成文本读出来');
}

main().catch(console.error);
