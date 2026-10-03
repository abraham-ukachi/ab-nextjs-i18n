// ===== CLI OUTPUT ===== //

const useColor = () => process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (text) => (useColor() ? `\u001b[${code}m${text}\u001b[0m` : String(text));

export const bold = paint(1);
export const dim = paint(2);
export const red = paint(31);
export const green = paint(32);
export const yellow = paint(33);
export const cyan = paint(36);

 
const visibleLength = (text) => String(text).replace(/\u001b\[\d+m/g, '').length;


/** Renders a plain-text table. */
export function table(headers, rows) {
  const widths = headers.map((header, index) => Math.max(visibleLength(header), ...rows.map((row) => visibleLength(row[index] ?? ''))));
  const line = (cells) => cells.map((cell, index) => String(cell ?? '') + ' '.repeat(widths[index] - visibleLength(cell ?? ''))).join('  ');
  return [bold(line(headers)), dim(widths.map((w) => '─'.repeat(w)).join('  ')), ...rows.map(line)].join('\n');
}


/** Renders a Markdown table. */
export function markdownTable(headers, rows) {
  const escape = (cell) => String(cell ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return [`| ${headers.map(escape).join(' | ')} |`, `|${headers.map(() => ':---').join('|')}|`, ...rows.map((row) => `| ${row.map(escape).join(' | ')} |`)].join('\n');
}

/** Splits `a,b , c` into `['a', 'b', 'c']`. */
export const splitList = (value) =>
  value === undefined ? undefined : String(value).split(',').map((item) => item.trim()).filter(Boolean);
