#!/usr/bin/env node
/**
 * Xiaomi TTS 情感起伏变化测试
 * 同一段文本内做多段情绪切换
 *
 * 注意：这是实验脚本，用于观察模型在复杂情绪切换下的表现，
 * 不代表当前正式链路会直接使用这种重控制写法。
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  baseUrl: process.env.XIAOMI_BASE_URL || 'https://your-mimo-base-url.example/v1',
  apiKey: process.env.XIAOMI_API_KEY || 'sk-123',
  voice: '茉莉',
  outputDir: '/root/.openclaw/workspace/tts-emotion-test'
};

const TEST_CASES = [
  {
    name: '多段情绪切换_标签版',
    userContent: null,
    assistantContent: `(开心)你知道吗，我今天终于拿到offer了！(兴奋)就是那种……做梦都会笑醒的感觉！

(突然低落)可是……(悲伤)我妈说太远了，不想让我去。

(沉默片刻)

(释然，带着笑意)算了，(温柔)至少我证明了自己可以。以后的路，一步一步走吧。`
  },
  {
    name: '多段情绪切换_自然语言版',
    userContent: '前半段是极度兴奋、语速偏快、声音明亮上扬的好消息；中段突然转为低落、语速放慢、声音下沉的悲伤；最后转为释然、温柔、带着淡淡笑意的平静。',
    assistantContent: `你知道吗，我今天终于拿到offer了！就是那种……做梦都会笑醒的感觉！

可是……我妈说太远了，不想让我去。

算了，至少我证明了自己可以。以后的路，一步一步走吧。`
  },
  {
    name: '多段情绪切换_叠加版',
    userContent: '前半段是极度兴奋、语速偏快、声音明亮上扬的好消息；中段突然转为低落、语速放慢、声音下沉的悲伤；最后转为释然、温柔、带着淡淡笑意的平静。',
    assistantContent: `(开心)你知道吗，我今天终于拿到offer了！(兴奋)就是那种……做梦都会笑醒的感觉！

(突然低落)可是……(悲伤)我妈说太远了，不想让我去。

(沉默片刻)

(释然，带着笑意)算了，(温柔)至少我证明了自己可以。以后的路，一步一步走吧。`
  },
  {
    name: '紧张到放松_标签版',
    userContent: null,
    assistantContent: `（紧张，深呼吸）呼……冷静，冷静。

（心跳加速）不就是一个面试吗……我已经准备三个月了。

（声音颤抖）自我介绍背了五十遍……应该没问题的。

（深呼吸，逐渐平静）

（放松下来，带着笑意）好了，该我了。加油。`
  },
  {
    name: '紧张到放松_自然语言版',
    userContent: '开头极度紧张，声音颤抖、语速快、气息不稳；中间慢慢平静，深呼吸后放松；最后带着自信的微笑，语速恢复正常。',
    assistantContent: `呼……冷静，冷静。

不就是一个面试吗……我已经准备三个月了。

自我介绍背了五十遍……应该没问题的。

好了，该我了。加油。`
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
  console.log('🎙️ Xiaomi TTS 情感起伏变化测试');
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
  console.log('📊 测试报告');
  console.log('========================');
  const successCount = results.filter(r => r.success).length;
  console.log(`成功: ${successCount}/${TEST_CASES.length}\n`);

  for (const r of results) {
    if (r.success) {
      console.log(`✅ ${r.filename}`);
    } else {
      console.log(`❌ ${r.name}: ${r.error}`);
    }
  }
}

main().catch(console.error);
