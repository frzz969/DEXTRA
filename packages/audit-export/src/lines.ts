import { createReadStream } from 'node:fs';

/**
 * Splits a file into lines without ever holding the whole file.
 *
 * Shared by the exporter and the verifier. It is I/O, not policy: a line that
 * this reader dropped would break the hash chain for the verifier just as
 * surely as a tampered line, so sharing it cannot hide a modification.
 *
 * `\r` is stripped so a file that travelled through a Windows checkout still
 * parses; the hash is computed over the raw bytes elsewhere, so stripping here
 * does not change what is being vouched for.
 */
export async function* readLines(path: string): AsyncGenerator<{ line: string; index: number }> {
  let leftover = '';
  let index = 0;
  const stream = createReadStream(path, { encoding: 'utf8' });
  for await (const chunk of stream) {
    leftover += chunk as string;
    let newline = leftover.indexOf('\n');
    while (newline !== -1) {
      const raw = leftover.slice(0, newline);
      leftover = leftover.slice(newline + 1);
      yield { line: raw.endsWith('\r') ? raw.slice(0, -1) : raw, index: index++ };
      newline = leftover.indexOf('\n');
    }
  }
  if (leftover !== '') {
    yield { line: leftover.endsWith('\r') ? leftover.slice(0, -1) : leftover, index: index++ };
  }
}
