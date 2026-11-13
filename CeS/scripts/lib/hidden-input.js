// Reads lines from a raw-mode terminal without echoing them (for passwords).
// Terminals may send Enter as "\r", "\n" or "\r\n", and may deliver several keys
// (or a whole paste) in one chunk, so input is processed character by character.

const CTRL_C = '\u0003';
const BACKSPACES = new Set(['\u0008', '\u007f']);

export function createLineCollector() {
  const lines = [];
  let buffer = '';
  let afterCR = false;
  const state = {
    cancelled: false,
    push(chunk) {
      for (const ch of chunk) {
        if (afterCR && ch === '\n') { afterCR = false; continue; } // second half of CRLF
        afterCR = false;
        if (ch === CTRL_C) { state.cancelled = true; return; }
        if (ch === '\r' || ch === '\n') {
          lines.push(buffer);
          buffer = '';
          afterCR = ch === '\r';
        } else if (BACKSPACES.has(ch)) {
          buffer = buffer.slice(0, -1);
        } else if (ch >= ' ') {
          buffer += ch;
        }
      }
    },
    /** Returns and clears the completed lines. */
    take: () => lines.splice(0),
  };
  return state;
}

/** Shows each prompt in turn and resolves with one hidden answer per prompt. */
export function askHidden(prompts, { stdin = process.stdin, stdout = process.stdout } = {}) {
  return new Promise((resolve, reject) => {
    const collector = createLineCollector();
    const answers = [];
    stdout.write(prompts[0]);
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();

    const finish = (err) => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      if (err) reject(err); else resolve(answers);
    };

    function onData(chunk) {
      collector.push(chunk);
      if (collector.cancelled) { stdout.write('\n'); finish(new Error('Cancelado.')); return; }
      for (const line of collector.take()) {
        answers.push(line);
        stdout.write('\n');
        if (answers.length === prompts.length) { finish(); return; }
        stdout.write(prompts[answers.length]);
      }
    }
    stdin.on('data', onData);
  });
}
