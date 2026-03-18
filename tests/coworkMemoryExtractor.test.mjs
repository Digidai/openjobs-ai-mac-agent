import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  extractTurnMemoryChanges,
  isQuestionLikeMemoryText,
} = require('../dist-electron/libs/coworkMemoryExtractor.js');

test('detects question-like memory text in Chinese and English', () => {
  assert.equal(isQuestionLikeMemoryText('你能帮我看一下这个报错吗？'), true);
  assert.equal(isQuestionLikeMemoryText('What model should I use for this task?'), true);
  assert.equal(isQuestionLikeMemoryText('我喜欢 Markdown 格式'), false);
});

test('extracts explicit add and delete memory commands', () => {
  const changes = extractTurnMemoryChanges({
    userText: '记住：我喜欢 Markdown 格式\n删除记忆：我住在上海浦东新区',
    assistantText: '好的，我会更新记忆。',
    guardLevel: 'standard',
  });

  assert.deepEqual(
    changes.filter((change) => change.isExplicit).map((change) => ({
      action: change.action,
      text: change.text,
      isExplicit: change.isExplicit,
    })),
    [
      { action: 'delete', text: '我住在上海浦东新区', isExplicit: true },
      { action: 'add', text: '我喜欢 Markdown 格式', isExplicit: true },
    ],
  );
});

test('extracts durable implicit memories and ignores question-like requests', () => {
  const changes = extractTurnMemoryChanges({
    userText: '我叫 Alice。我喜欢 Markdown 格式。请帮我看下这个报错怎么修复？',
    assistantText: '收到，我会记住这些长期信息，并继续处理你的问题。',
    guardLevel: 'standard',
  });

  assert.deepEqual(
    changes.map((change) => change.text),
    ['我叫 Alice', '我喜欢 Markdown 格式'],
  );
  assert.ok(changes.every((change) => change.action === 'add'));
  assert.ok(changes.every((change) => change.isExplicit === false));
});

test('respects strict guard level for borderline implicit candidates', () => {
  const changes = extractTurnMemoryChanges({
    userText: '以后请默认用中文回复',
    assistantText: '好的，我会按你的偏好来回复。',
    guardLevel: 'strict',
  });

  assert.deepEqual(changes, [
    {
      action: 'add',
      text: '以后请默认用中文回复',
      confidence: 0.86,
      isExplicit: false,
      reason: 'implicit:assistant-preference',
    },
  ]);
});
