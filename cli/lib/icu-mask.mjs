// ===== ICU MASK ===== //
//
// A small ICU MessageFormat parser that mirrors the rules of
// @formatjs/icu-messageformat-parser (which next-intl / icu-minify use), plus:
//  - `getIcuSignature`: the placeholders/tags a message needs (to compare locales),
//  - `maskIcu`: turns a message into provider-safe "units" (XML-ish text where
//    every `{arg}`, `#`, glossary term and plural/select block is a `<ph id="N"/>`
//    token and rich-text tags stay as `<b>…</b>`), and rebuilds it afterwards.
// Plural/select blocks are never sent as ICU: each branch becomes its own unit.
// Syntax errors are authoritative from `validateIcu` (icu-minify's compiler).

import compile from 'icu-minify/compile';

export class IcuSyntaxError extends Error {
  constructor(code, offset) {
    super(`${code} at offset ${offset}`);
    this.name = 'IcuSyntaxError';
    this.code = code;
    this.offset = offset;
  }
}

const COMPLEX_TYPES = new Set(['plural', 'selectordinal', 'select']);
const SIMPLE_TYPES = new Set(['number', 'date', 'time']);

// Unicode Pattern_Syntax + Pattern_White_Space (ASCII part) end an identifier.
const isIdentifierChar = (ch) => !/[\s!-/:-@[-^`{-~]/.test(ch);
const isAlpha = (ch) => /[a-zA-Z]/.test(ch ?? '');
const isTagNameChar = (ch) => /[-.0-9_a-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/.test(ch ?? '');
const isPluralLike = (type) => type === 'plural' || type === 'selectordinal';


class Parser {
  constructor(message) {
    this.s = message;
    this.i = 0;
  }

  error(code) {
    throw new IcuSyntaxError(code, this.i);
  }

  eof() {
    return this.i >= this.s.length;
  }

  ch() {
    return this.s[this.i];
  }

  peek() {
    return this.s[this.i + 1];
  }

  skipSpace() {
    while (!this.eof() && /\s/.test(this.ch())) this.i++;
  }

  identifier() {
    const start = this.i;
    while (!this.eof() && isIdentifierChar(this.ch())) this.i++;
    return this.s.slice(start, this.i);
  }

  parseMessage(depth, parentArgType, expectingCloseTag) {
    const nodes = [];
    while (!this.eof()) {
      const ch = this.ch();
      if (ch === '{') {
        nodes.push(this.parseArgument(depth));
      } else if (ch === '}' && depth > 0) {
        break;
      } else if (ch === '#' && isPluralLike(parentArgType)) {
        nodes.push({ type: 'pound', raw: '#' });
        this.i++;
      } else if (ch === '<' && this.peek() === '/') {
        if (expectingCloseTag) break;
        this.error('UNMATCHED_CLOSING_TAG');
      } else if (ch === '<' && isAlpha(this.peek())) {
        nodes.push(this.parseTag(depth, parentArgType));
      } else {
        nodes.push(this.parseLiteral(depth, parentArgType));
      }
    }
    return mergeText(nodes);
  }

  parseTag(depth, parentArgType) {
    const start = this.i;
    this.i++; // <
    const nameStart = this.i;
    while (!this.eof() && isTagNameChar(this.ch())) this.i++;
    const name = this.s.slice(nameStart, this.i);
    this.skipSpace();

    if (this.s.startsWith('/>', this.i)) {
      // `<br/>` is plain text for formatjs.
      this.i += 2;
      const raw = this.s.slice(start, this.i);
      return { type: 'text', value: `<${name}/>`, raw };
    }
    if (this.ch() !== '>') this.error('INVALID_TAG');
    this.i++;

    const children = this.parseMessage(depth + 1, parentArgType, true);
    if (!this.s.startsWith('</', this.i)) this.error('UNCLOSED_TAG');
    this.i += 2;
    const closeStart = this.i;
    while (!this.eof() && isTagNameChar(this.ch())) this.i++;
    if (this.s.slice(closeStart, this.i) !== name) this.error('UNMATCHED_CLOSING_TAG');
    this.skipSpace();
    if (this.ch() !== '>') this.error('INVALID_TAG');
    this.i++;
    return { type: 'tag', name, children };
  }

  parseLiteral(depth, parentArgType) {
    const start = this.i;
    let value = '';
    while (!this.eof()) {
      const ch = this.ch();
      if (ch === "'") {
        const next = this.peek();
        if (next === "'") {
          value += "'";
          this.i += 2;
          continue;
        }
        if (next === '{' || next === '<' || next === '>' || next === '}' || (next === '#' && isPluralLike(parentArgType))) {
          this.i += 1; // opening quote
          value += this.ch();
          this.i += 1;
          while (!this.eof()) {
            if (this.ch() === "'") {
              if (this.peek() === "'") {
                value += "'";
                this.i += 2;
              } else {
                this.i += 1;
                break;
              }
            } else {
              value += this.ch();
              this.i += 1;
            }
          }
          continue;
        }
        value += "'";
        this.i++;
        continue;
      }
      if (ch === '{' || (ch === '#' && isPluralLike(parentArgType)) || (ch === '}' && depth > 0)) break;
      if (ch === '<' && (isAlpha(this.peek()) || this.peek() === '/')) break;
      value += ch;
      this.i++;
    }
    return { type: 'text', value, raw: this.s.slice(start, this.i) };
  }

  parseArgument(depth) {
    const start = this.i;
    this.i++; // {
    this.skipSpace();
    if (this.eof()) this.error('EXPECT_ARGUMENT_CLOSING_BRACE');
    if (this.ch() === '}') this.error('EMPTY_ARGUMENT');
    const name = this.identifier();
    if (!name) this.error('MALFORMED_ARGUMENT');
    this.skipSpace();
    if (this.eof()) this.error('EXPECT_ARGUMENT_CLOSING_BRACE');

    if (this.ch() === '}') {
      this.i++;
      return { type: 'argument', name, argType: null, raw: this.s.slice(start, this.i) };
    }
    if (this.ch() !== ',') this.error('MALFORMED_ARGUMENT');
    this.i++;
    this.skipSpace();
    const argType = this.identifier();
    if (!argType) this.error('EXPECT_ARGUMENT_TYPE');
    this.skipSpace();

    if (SIMPLE_TYPES.has(argType)) {
      if (this.ch() === ',') {
        this.i++;
        this.skipSpace();
        this.skipStyle();
      }
      this.skipSpace();
      if (this.ch() !== '}') this.error('EXPECT_ARGUMENT_CLOSING_BRACE');
      this.i++;
      return { type: 'argument', name, argType, raw: this.s.slice(start, this.i) };
    }

    if (!COMPLEX_TYPES.has(argType)) this.error('INVALID_ARGUMENT_TYPE');
    if (this.ch() !== ',') this.error('EXPECT_SELECT_ARGUMENT_OPTIONS');
    this.i++;
    this.skipSpace();

    let offset = null;
    if (argType !== 'select' && this.s.startsWith('offset:', this.i)) {
      this.i += 'offset:'.length;
      this.skipSpace();
      const match = /^-?\d+/.exec(this.s.slice(this.i));
      if (!match) this.error('INVALID_PLURAL_ARGUMENT_OFFSET_VALUE');
      offset = match[0];
      this.i += match[0].length;
      this.skipSpace();
    }

    const options = [];
    const seen = new Set();
    while (!this.eof() && this.ch() !== '}') {
      let key;
      if (this.ch() === '=') {
        const match = /^=-?\d+(?:\.\d+)?/.exec(this.s.slice(this.i));
        if (!match) this.error('INVALID_PLURAL_ARGUMENT_SELECTOR');
        key = match[0];
        this.i += key.length;
      } else {
        key = this.identifier();
      }
      if (!key) this.error(argType === 'select' ? 'EXPECT_SELECT_ARGUMENT_SELECTOR' : 'EXPECT_PLURAL_ARGUMENT_SELECTOR');
      if (seen.has(key)) this.error(argType === 'select' ? 'DUPLICATE_SELECT_ARGUMENT_SELECTOR' : 'DUPLICATE_PLURAL_ARGUMENT_SELECTOR');
      seen.add(key);
      this.skipSpace();
      if (this.ch() !== '{') this.error('EXPECT_PLURAL_ARGUMENT_SELECTOR_FRAGMENT');
      this.i++;
      const children = this.parseMessage(depth + 1, argType, false);
      if (this.ch() !== '}') this.error('EXPECT_ARGUMENT_CLOSING_BRACE');
      this.i++;
      options.push({ key, children });
      this.skipSpace();
    }
    if (this.eof()) this.error('EXPECT_ARGUMENT_CLOSING_BRACE');
    if (options.length === 0) this.error('EXPECT_SELECT_ARGUMENT_OPTIONS');
    if (!seen.has('other')) this.error('MISSING_OTHER_CLAUSE');
    this.i++; // }
    return { type: argType, name, offset, options, raw: this.s.slice(start, this.i) };
  }

  skipStyle() {
    // `{n, number, ::currency/EUR}` / `{d, date, short}`: read up to the closing brace.
    let nesting = 0;
    const start = this.i;
    while (!this.eof()) {
      const ch = this.ch();
      if (ch === "'") {
        const end = this.s.indexOf("'", this.i + 1);
        if (end === -1) this.error('UNCLOSED_QUOTE_IN_ARGUMENT_STYLE');
        this.i = end + 1;
      } else if (ch === '{') {
        nesting++;
        this.i++;
      } else if (ch === '}') {
        if (nesting === 0) break;
        nesting--;
        this.i++;
      } else {
        this.i++;
      }
    }
    if (this.i === start || this.s.slice(start, this.i).trim() === '') this.error('EXPECT_ARGUMENT_STYLE');
  }
}

function mergeText(nodes) {
  const merged = [];
  for (const node of nodes) {
    const last = merged[merged.length - 1];
    if (node.type === 'text' && last?.type === 'text') {
      last.value += node.value;
      last.raw += node.raw;
    } else {
      merged.push(node);
    }
  }
  return merged;
}


/**
 * Parses an ICU message into a small AST (throws `IcuSyntaxError`).
 *
 * @param { string } message
 * @returns { Array<object> }
 */
export function parseIcu(message) {
  const parser = new Parser(String(message));
  const nodes = parser.parseMessage(0, null, false);
  if (!parser.eof()) parser.error('UNMATCHED_CLOSING_BRACE');
  return nodes;
}


/**
 * Prints an AST back to ICU. With untouched nodes it's byte-identical to the input.
 *
 * @param { Array<object> } nodes
 * @returns { string }
 */
export function printIcu(nodes) {
  return nodes.map(printNode).join('');
}

function printNode(node) {
  switch (node.type) {
    case 'text':
    case 'argument':
    case 'pound':
      return node.raw;
    case 'tag':
      return `<${node.name}>${printIcu(node.children)}</${node.name}>`;
    default:
      return node.raw;
  }
}


/**
 * Validates an ICU message with icu-minify's compiler (the one next-intl uses).
 *
 * @param { string } message
 * @returns { { ok: true } | { ok: false, error: string } }
 */
export function validateIcu(message) {
  try {
    compile(String(message));
  } catch (error) {
    return { ok: false, error: error?.message ?? String(error) };
  }
  try {
    parseIcu(message);
  } catch (error) {
    return { ok: false, error: error.code ?? error.message };
  }
  return { ok: true };
}


/**
 * Returns what a message needs to stay compatible across locales:
 * argument names, rich-text tags and plural/select argument names.
 *
 * @param { string | Array<object> } messageOrAst
 * @returns { { arguments: string[], tags: string[], complex: string[], selectKeys: Record<string, string[]> } }
 */
export function getIcuSignature(messageOrAst) {
  const ast = typeof messageOrAst === 'string' ? parseIcu(messageOrAst) : messageOrAst;
  const args = new Set();
  const tags = [];
  const complex = new Set();
  const selectKeys = {};

  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.type === 'argument') args.add(node.name);
      else if (node.type === 'tag') {
        tags.push(node.name);
        walk(node.children);
      } else if (COMPLEX_TYPES.has(node.type)) {
        args.add(node.name);
        complex.add(`${node.name}:${node.type}`);
        if (node.type === 'select') {
          selectKeys[node.name] = [...new Set([...(selectKeys[node.name] ?? []), ...node.options.map((o) => o.key)])].sort();
        }
        for (const option of node.options) walk(option.children);
      }
    }
  };
  walk(ast);

  return { arguments: [...args].sort(), tags: tags.sort(), complex: [...complex].sort(), selectKeys };
}


/**
 * Lists the CLDR plural categories a message lacks for `locale` (`plural` uses the
 * cardinal rules, `selectordinal` the ordinal ones). Exact matches (`=0`) don't count:
 * `other` covers missing categories at runtime, but the grammar is usually wrong
 * (e.g. `ru` needs `one`, `few`, `many`, `other`).
 *
 * @param { string | Array<object> } messageOrAst
 * @param { string } locale
 * @returns { Array<{ name: string, type: 'plural' | 'selectordinal', missing: string[] }> }
 */
export function getMissingPluralCategories(messageOrAst, locale) {
  const ast = typeof messageOrAst === 'string' ? parseIcu(messageOrAst) : messageOrAst;
  const categories = (type) => {
    try {
      return new Intl.PluralRules(locale, { type }).resolvedOptions().pluralCategories;
    } catch {
      return [];
    }
  };
  const required = { plural: categories('cardinal'), selectordinal: categories('ordinal') };
  const out = [];

  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.type === 'tag') walk(node.children);
      else if (COMPLEX_TYPES.has(node.type)) {
        if (required[node.type]) {
          const keys = new Set(node.options.map((option) => option.key));
          const missing = required[node.type].filter((category) => !keys.has(category));
          if (missing.length) out.push({ name: node.name, type: node.type, missing });
        }
        for (const option of node.options) walk(option.children);
      }
    }
  };
  walk(ast);
  return out;
}


/**
 * Compares the signatures of a source and a target message.
 *
 * @returns { string[] } human readable differences (empty = compatible)
 */
export function diffIcuSignatures(source, target) {
  const problems = [];
  const missing = source.arguments.filter((a) => !target.arguments.includes(a));
  const extra = target.arguments.filter((a) => !source.arguments.includes(a));
  if (missing.length) problems.push(`missing placeholder(s) ${missing.map((a) => `{${a}}`).join(', ')}`);
  if (extra.length) problems.push(`unknown placeholder(s) ${extra.map((a) => `{${a}}`).join(', ')}`);
  if (source.tags.join(',') !== target.tags.join(',')) {
    problems.push(`tags differ (expected <${source.tags.join('>, <') || '∅'}>, got <${target.tags.join('>, <') || '∅'}>)`);
  }
  const complexMissing = source.complex.filter((c) => !target.complex.includes(c) && target.arguments.includes(c.split(':')[0]));
  if (complexMissing.length) problems.push(`argument type changed for ${complexMissing.join(', ')}`);
  for (const [name, keys] of Object.entries(source.selectKeys)) {
    const targetKeys = target.selectKeys[name];
    if (targetKeys && targetKeys.join(',') !== keys.join(',')) problems.push(`select options of {${name}} differ`);
  }
  return problems;
}


// ----- masking ----- //

const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

export function escapeXml(text) {
  return text.replace(/[&<>]/g, (ch) => XML_ESCAPES[ch]);
}

export function unescapeXml(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, '&');
}


/**
 * Escapes plain text so ICU reads it literally (`{` → `'{'`, `'{` → `'''{'`...).
 *
 * @param { string } text
 * @param { string | null } [parentArgType] - `plural`/`selectordinal` also escapes `#`
 * @param { string } [following] - the first character printed right after `text`
 * @returns { string }
 */
export function escapeIcuText(text, parentArgType = null, following = undefined) {
  const plural = isPluralLike(parentArgType);
  // Characters that must be quoted to stay literal.
  const special = (ch, next) => ch === '{' || ch === '}' || (ch === '#' && plural) || (ch === '<' && (isAlpha(next) || next === '/'));
  // Characters that turn a preceding apostrophe into a quote opener.
  const opensQuote = (ch) => ch === "'" || ch === '{' || ch === '}' || ch === '<' || ch === '>' || (ch === '#' && plural);
  const nextOf = (i) => (i + 1 < text.length ? text[i + 1] : following);

  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (special(ch, nextOf(i))) {
      // One quoted run for consecutive specials (and apostrophes, doubled inside).
      out += "'";
      while (i < text.length && (text[i] === "'" || special(text[i], nextOf(i)))) {
        out += text[i] === "'" ? "''" : text[i];
        i++;
      }
      out += "'";
      continue;
    }
    const next = nextOf(i);
    out += ch === "'" && next !== undefined && opensQuote(next) ? "''" : ch;
    i++;
  }
  return out;
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function termRegExp(terms) {
  const sorted = [...new Set(terms.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (sorted.length === 0) return null;
  const parts = sorted.map((term) => {
    const head = /^\w/.test(term) ? '(?<![\\w])' : '';
    const tail = /\w$/.test(term) ? '(?![\\w])' : '';
    return `${head}${escapeRegExp(term)}${tail}`;
  });
  return new RegExp(parts.join('|'), 'g');
}

const TOKEN_PATTERN = /<ph\s+id\s*=\s*["']?(\d+)["']?\s*\/?>(?:\s*<\/ph>)?|<(\/?)([A-Za-z][\w.-]*)\s*>|<|[^<]+/g;


/**
 * Splits a message into translatable units and returns a `rebuild` function.
 *
 * @param { string } message
 * @param { { terms?: string[] } } [options] - glossary terms that must never be translated
 * @returns {{ units: Array<{ id: number, text: string, translatable: boolean }>, rebuild: (translations: Map<number, string> | Record<number, string>) => string }}
 */
export function maskIcu(message, options = {}) {
  const ast = parseIcu(message);
  const terms = termRegExp(options.terms ?? []);
  const units = [];

  const maskText = (value, unit) => {
    if (!terms) return escapeXml(value);
    let out = '';
    let last = 0;
    for (const match of value.matchAll(terms)) {
      out += escapeXml(value.slice(last, match.index));
      out += addToken(unit, { kind: 'term', value: match[0] });
      last = match.index + match[0].length;
    }
    return out + escapeXml(value.slice(last));
  };

  const addToken = (unit, entry) => {
    unit.tokens.push(entry);
    return `<ph id="${unit.tokens.length - 1}"/>`;
  };

  const maskNodes = (nodes, unit) => {
    let out = '';
    for (const node of nodes) {
      if (node.type === 'text') out += maskText(node.value, unit);
      else if (node.type === 'argument' || node.type === 'pound') out += addToken(unit, { kind: node.type, node });
      else if (node.type === 'tag') {
        unit.tags.push(node.name);
        out += `<${node.name}>${maskNodes(node.children, unit)}</${node.name}>`;
      } else {
        const branches = node.options.map((option) => ({ key: option.key, unit: buildUnit(option.children, node.type) }));
        const entry = { kind: 'complex', node, branches };
        unit.complex.set(node, entry);
        out += addToken(unit, entry);
      }
    }
    return out;
  };

  const buildUnit = (nodes, parentArgType) => {
    const unit = { id: units.length, text: '', translatable: false, tokens: [], tags: [], complex: new Map(), nodes, parentArgType };
    units.push(unit);
    unit.text = maskNodes(nodes, unit);
    unit.translatable = /\p{L}/u.test(unit.text.replace(/<[^>]*>/g, ''));
    return unit;
  };

  const root = buildUnit(ast, null);

  const rebuild = (translations) => {
    const get = (id) => (translations instanceof Map ? translations.get(id) : translations?.[id]);

    const renderComplex = (entry) => {
      const { node, branches } = entry;
      const rendered = branches.map((branch) => ({ key: branch.key, text: renderUnit(branch.unit, '}') }));
      const unchanged = rendered.every((branch, index) => branch.text === printIcu(node.options[index].children));
      if (unchanged) return node.raw;
      const offset = node.offset !== null ? ` offset:${node.offset}` : '';
      return `{${node.name}, ${node.type},${offset} ${rendered.map((branch) => `${branch.key} {${branch.text}}`).join(' ')}}`;
    };

    const renderOriginal = (nodes, unit) =>
      nodes
        .map((node) => {
          if (node.type === 'tag') return `<${node.name}>${renderOriginal(node.children, unit)}</${node.name}>`;
          if (COMPLEX_TYPES.has(node.type)) return renderComplex(unit.complex.get(node));
          return node.raw;
        })
        .join('');

    const renderUnit = (unit, following) => {
      const translated = get(unit.id);
      if (translated == null || translated === unit.text || !unit.translatable) return renderOriginal(unit.nodes, unit);

      const segments = [];
      const used = new Array(unit.tokens.length).fill(0);
      const tags = [];
      for (const match of String(translated).matchAll(TOKEN_PATTERN)) {
        const [whole, id, slash, tag] = match;
        if (id !== undefined) {
          const entry = unit.tokens[Number(id)];
          if (!entry) throw new Error(`unknown placeholder token ${whole}`);
          used[Number(id)]++;
          if (entry.kind === 'term') segments.push({ text: entry.value });
          else if (entry.kind === 'complex') segments.push({ raw: renderComplex(entry) });
          else segments.push({ raw: entry.node.raw });
        } else if (tag !== undefined) {
          if (!slash) tags.push(tag);
          segments.push({ raw: `<${slash}${tag}>` });
        } else {
          segments.push({ text: unescapeXml(whole) });
        }
      }

      const wrong = used.map((count, index) => (count === 1 ? null : `#${index} used ${count}×`)).filter(Boolean);
      if (wrong.length) throw new Error(`placeholder tokens must be kept exactly once (${wrong.join(', ')})`);
      if ([...tags].sort().join(',') !== [...unit.tags].sort().join(',')) throw new Error('rich-text tags were changed');

      // Merge adjacent text, then escape each text run knowing what follows it.
      const merged = [];
      for (const segment of segments) {
        const last = merged[merged.length - 1];
        if (segment.text !== undefined && last?.text !== undefined) last.text += segment.text;
        else merged.push({ ...segment });
      }
      return merged
        .map((segment, index) => {
          if (segment.raw !== undefined) return segment.raw;
          const nextSegment = merged[index + 1];
          const next = nextSegment ? nextSegment.raw?.[0] : following;
          return escapeIcuText(segment.text, unit.parentArgType, next);
        })
        .join('');
    };

    return renderUnit(root);
  };

  return {
    units: units.map(({ id, text, translatable }) => ({ id, text, translatable })),
    rebuild,
  };
}
