import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { createLineCollector, askHidden } from '../../scripts/lib/hidden-input.js';

function fakeTerminal() {
  const stdin = new PassThrough();
  stdin.setRawMode = () => stdin;
  let written = '';
  const stdout = { write: (text) => { written += text; } };
  return { stdin, stdout, output: () => written };
}

describe('askHidden', () => {
  test('Windows Enter (\\r then \\n in separate chunks) does not skip the confirmation', async () => {
    const term = fakeTerminal();
    const answers = askHidden(['Senha: ', 'Confirme: '], term);
    term.stdin.write('senha123\r');
    term.stdin.write('\n');
    term.stdin.write('senha123\r');
    assert.deepEqual(await answers, ['senha123', 'senha123']);
    assert.doesNotMatch(term.output(), /senha123/); // never echoed
  });

  test('Ctrl+C rejects', async () => {
    const term = fakeTerminal();
    const answers = askHidden(['Senha: '], term);
    term.stdin.write('\u0003');
    await assert.rejects(answers, /Cancelado/);
  });
});

describe('createLineCollector (hidden password input)', () => {
  test('CRLF counts as a single Enter, even when split across chunks', () => {
    const lines = createLineCollector();
    lines.push('senha123\r');
    lines.push('\n');
    lines.push('senha123\r\n');
    assert.deepEqual(lines.take(), ['senha123', 'senha123']);
  });

  test('pasted text arriving in one chunk is split into lines', () => {
    const lines = createLineCollector();
    lines.push('abcdefgh\rabcdefgh\r');
    assert.deepEqual(lines.take(), ['abcdefgh', 'abcdefgh']);
  });

  test('typing one key per chunk works', () => {
    const lines = createLineCollector();
    for (const key of ['a', 'b', 'c', '\r']) lines.push(key);
    assert.deepEqual(lines.take(), ['abc']);
  });

  test('backspace removes the previous character', () => {
    const lines = createLineCollector();
    lines.push('abx\u007fc\r');
    lines.push('abx\u0008c\n');
    assert.deepEqual(lines.take(), ['abc', 'abc']);
  });

  test('Ctrl+C marks the input as cancelled', () => {
    const lines = createLineCollector();
    lines.push('ab\u0003');
    assert.equal(lines.cancelled, true);
  });

  test('a bare LF (Unix terminals) also ends a line', () => {
    const lines = createLineCollector();
    lines.push('um\ndois\n');
    assert.deepEqual(lines.take(), ['um', 'dois']);
  });
});
