// ===== translate-shell (`trans`) provider ===== //
// Needs the `trans` binary on PATH. Runs it with execFile (no shell), one string at a time.
// Opt-in with `--provider trans`. Expect more rejected placeholders than with DeepL/OpenAI.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const transProvider = {
  name: 'trans',
  batchSize: 1,
  envKeys: [],
  isAvailable: () => true,

  async translate({ texts, from, to, execFile: exec = run }) {
    const results = [];
    for (const text of texts) {
      // `--` ends the options: a text starting with "-" is never read as a flag.
      const { stdout } = await exec('trans', ['-b', '-no-warn', '-no-autocorrect', `${from}:${to}`, '--', text], { timeout: 30_000 });
      results.push(String(stdout).replace(/\n$/, ''));
    }
    return results;
  },
};

export default transProvider;
