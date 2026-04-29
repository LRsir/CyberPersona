#!/usr/bin/env node
/**
 * Xiaomi TTS 语音设计版测试
 * mimo-v2.5-tts-voicedesign
 * 用文本描述生成全新音色
 *
 * 注意：这是独立实验路线，与当前正式链路（mimo-v2.5-tts + 茉莉 + tag_only）无关。
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  baseUrl: process.env.XIAOMI_BASE_URL || 'https://your-mimo-base-url.example/v1',
  apiKey: process.env.XIAOMI_API_KEY || 'sk-123',
  outputDir: '/root/.openclaw/workspace/tts-voicedesign-test'
};

const TEST_TEXT = '你好，我是你新设计的专属声音。很高兴认识你，希望我们能成为好朋友。';

const TEST_CASES = [
  {
    name: 'A_温柔知性大姐姐',
    voiceDescription: '一位三十出头的知性女性，声音温柔醇厚，像深夜电台主持人。语速偏慢，咬字清晰，尾音带着淡淡的暖意。标准普通话，没有明显口音。'
  },
  {
    name: 'B_活泼元气少女',
    voiceDescription: '十八九岁的元气少女，声音明亮清脆，像刚出太阳时分的露珠。语速偏快，带着笑意，偶尔有俏皮的尾音上扬。标准普通话，青春感满满。'
  },
  {
    name: 'C_沉稳低音大叔',
    voiceDescription: '四十多岁的成熟男性，声音低沉磁性，像老唱片里的爵士歌手。语速从容，停顿有节奏感，带着岁月沉淀的稳重。标准普通话，略带沙哑的质感。'
  },
  {
    name: 'D_清冷疏离御姐',
    voiceDescription: '二十多岁的冷感女性，声音清亮但疏离，像高山上的雪水。语速不快不慢，咬字干脆利落，尾音不带感情波动。标准普通话，有一种让人不敢轻易靠近的气场。'
  },
  {
    name: 'E_俏皮小狐狸',
    voiceDescription: '一只机灵的小狐狸化身的少女，声音活泼狡黠，带着恶作剧得逞后的得意。语速轻快，偶尔有"嘿嘿"的轻笑声，尾音俏皮地上扬。标准普通话，但带着一点点动物般的灵动。'
  },
  {
    name: 'F_沧桑老 storyteller',
    voiceDescription: '六十多岁的老人，声音沙哑但温暖，像坐在村口讲故事的老爷爷。语速很慢，有长长的停顿，偶尔咳嗽或叹气。带着方言味道的普通话，满是岁月的故事感。'
  }
];

if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

function sendTTSRequest(testCase, index) {
  return new Promise((resolve, reject) => {
    const payload = {
      model: 'mimo-v2.5-tts-voicedesign',
      messages: [
        {
          role: 'user',
          content: testCase.voiceDescription
        },
        {
          role: 'assistant',
          content: TEST_TEXT
        }
      ],
      audio: {
        format: 'mp3'
        // voice 字段忽略，由 voiceDescription 决定
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
            description: testCase.voiceDescription,
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
  console.log('🎨 Xiaomi TTS 语音设计版测试');
  console.log('========================');
  console.log(`模型: mimo-v2.5-tts-voicedesign`);
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
    if (i < TEST_CASES.length - 1) await new Promise(r => setTimeout(r, 3000));
  }

  console.log('\n========================');
  console.log('📊 测试报告');
  console.log('========================');
  const successCount = results.filter(r => r.success).length;
  console.log(`成功: ${successCount}/${TEST_CASES.length}\n`);

  for (const r of results) {
    if (r.success) {
      console.log(`✅ ${r.name}`);
      console.log(`   文件: ${r.filename}`);
      console.log(`   描述: ${r.description.substring(0, 60)}...`);
      console.log();
    } else {
      console.log(`❌ ${r.name}: ${r.error}`);
    }
  }

  const reportPath = path.join(CONFIG.outputDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    model: 'mimo-v2.5-tts-voicedesign',
    summary: { total: TEST_CASES.length, success: successCount },
    results: results
  }, null, 2));
  console.log(`📄 报告: ${reportPath}`);
}

main().catch(console.error);
