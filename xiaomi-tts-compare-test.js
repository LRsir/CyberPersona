#!/usr/bin/env node
/**
 * Xiaomi TTS 风格控制对比测试
 * 4组对照：纯文本 / 纯标签 / 纯自然语言 / 自然语言+标签叠加
 *
 * 注意：这是历史实验脚本，用于理解 Xiaomi 官方能力边界，
 * 不代表当前项目正式链路推荐策略。
 * 当前正式链路请以 TTS-TESTS.md 与 cyber-gf-tts.js 为准。
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  baseUrl: process.env.XIAOMI_BASE_URL || 'https://your-mimo-base-url.example/v1',
  apiKey: process.env.XIAOMI_API_KEY || 'sk-123',
  voice: '茉莉',
  outputDir: '/root/.openclaw/workspace/tts-compare-test'
};

const TEST_TEXT = '今晚的月光很温柔，像一层薄薄的纱，轻轻盖在森林上。小狐狸蜷在老橡树的树洞里，尾巴盖住了鼻尖，听着远处溪水流动的声音，慢慢闭上了眼睛。';

const TEST_CASES = [
  {
    name: 'A_纯文本无控制',
    userContent: null,
    assistantContent: TEST_TEXT
  },
  {
    name: 'B_纯音频标签',
    userContent: null,
    assistantContent: `(温柔)${TEST_TEXT}`
  },
  {
    name: 'C_纯自然语言风格',
    userContent: '温柔、舒缓，像睡前讲故事一样，语速偏慢，带着淡淡的倦意和安心。',
    assistantContent: TEST_TEXT
  },
  {
    name: 'D_自然语言+标签叠加',
    userContent: '温柔、舒缓，像睡前讲故事一样，语速偏慢，带着淡淡的倦意和安心。',
    assistantContent: `(温柔)${TEST_TEXT}`
  }
];

if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

function sendTTSRequest(testCase, index) {
  return new Promise((resolve, reject) => {
    const messages = [];
    if (testCase.userContent) {
      messages.push({ role: 'user', content: testCase.userContent });
    }
    messages.push({ role: 'assistant', content: testCase.assistantContent });

    const payload = {
      model: 'mimo-v2.5-tts',
      messages: messages,
      audio: {
        format: 'mp3',
        voice: CONFIG.voice
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
            reject(new Error(`API error: ${JSON.stringify(response.detail).substring(0, 200)}`));
            return;
          }
          const audioData = response.choices?.[0]?.message?.audio?.data;
          if (!audioData) {
            reject(new Error('No audio data'));
            return;
          }
          const buffer = Buffer.from(audioData, 'base64');
          const filename = `${String(index).padStart(2, '0')}_${testCase.name}.mp3`;
          const filepath = path.join(CONFIG.outputDir, filename);
          fs.writeFileSync(filepath, buffer);
          resolve({
            name: testCase.name,
            filename: filename,
            size: buffer.length,
            userContent: testCase.userContent,
            assistantContent: testCase.assistantContent,
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
  console.log('🎙️ Xiaomi TTS 风格控制对比测试');
  console.log('========================');
  console.log(`Voice: ${CONFIG.voice}`);
  console.log(`测试组数: ${TEST_CASES.length}`);
  console.log('========================\n');

  const results = [];
  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    process.stdout.write(`[${i + 1}/${TEST_CASES.length}] ${tc.name} ... `);
    try {
      const result = await sendTTSRequest(tc, i + 1);
      results.push(result);
      console.log(`✅ ${result.filename} (${(result.size / 1024).toFixed(1)} KB)`);
    } catch (err) {
      results.push({ name: tc.name, error: err.message, success: false });
      console.log(`❌ ${err.message}`);
    }
    if (i < TEST_CASES.length - 1) await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n========================');
  console.log('📊 对比报告');
  console.log('========================');
  const successCount = results.filter(r => r.success).length;
  console.log(`成功: ${successCount}/${TEST_CASES.length}\n`);

  for (const r of results) {
    if (r.success) {
      console.log(`${r.name}:`);
      console.log(`  文件: ${r.filename}`);
      if (r.userContent) console.log(`  User风格: ${r.userContent.substring(0, 50)}...`);
      else console.log(`  User风格: (无)`);
      console.log(`  Assistant标签: ${r.assistantContent.substring(0, 60)}...`);
      console.log();
    } else {
      console.log(`  ❌ ${r.name}: ${r.error}`);
    }
  }

  const reportPath = path.join(CONFIG.outputDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    voice: CONFIG.voice,
    summary: { total: TEST_CASES.length, success: successCount },
    results: results
  }, null, 2));
  console.log(`📄 报告: ${reportPath}`);
}

main().catch(console.error);
