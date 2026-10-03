import { describe, expect, it } from 'vitest';
import {
  diffIcuSignatures,
  escapeIcuText,
  getIcuSignature,
  maskIcu,
  parseIcu,
  printIcu,
  validateIcu,
} from '../cli/lib/icu-mask.mjs';

const MESSAGES = [
  'Hello {name}!',
  '{count, plural, =0 {No items} one {# item} other {# items}}',
  'Learn more about <link>{name}</link>',
  "It''s '{literal}' ok",
  'You have {n, plural, one {# new message from {who}} other {# messages}} in abElements.',
  '{g, select, male {He} female {She} other {They}} said hi',
  'a<br/>b & c < d',
  '{d, date, short} at {p, number, ::currency/EUR}',
  '{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}',
];

const upper = (text: string) => text.replace(/(^|>)([^<]+)/g, (_, head: string, body: string) => head + body.toUpperCase());

describe('icu-mask', () => {
  it('prints the AST back byte for byte', () => {
    for (const message of MESSAGES) expect(printIcu(parseIcu(message))).toBe(message);
  });

  it('round-trips through mask/rebuild without translations', () => {
    for (const message of MESSAGES) expect(maskIcu(message).rebuild(new Map())).toBe(message);
  });

  it('masks placeholders, # and glossary terms, keeps tags and splits plural branches', () => {
    const { units } = maskIcu('You have {n, plural, one {# new message from {who}} other {# messages}} in abElements.', { terms: ['abElements'] });
    expect(units.map((unit) => unit.text)).toEqual([
      'You have <ph id="0"/> in <ph id="1"/>.',
      '<ph id="0"/> new message from <ph id="1"/>',
      '<ph id="0"/> messages',
    ]);
    expect(maskIcu('Learn more about <link>{name}</link>').units[0].text).toBe('Learn more about <link><ph id="0"/></link>');
    expect(maskIcu('{count}').units[0].translatable).toBe(false);
  });

  it('rebuilds valid ICU from translated units (and escapes the text)', () => {
    const masked = maskIcu('{count, plural, one {# file in {folder}} other {# files}}');
    const value = masked.rebuild(new Map([[1, '<ph id="0"/> fichier dans l’<ph id="1"/>'], [2, "<ph id=\"0\"/> fichiers {sic}"]]));
    expect(value).toBe("{count, plural, one {# fichier dans l’{folder}} other {# fichiers '{'sic'}'}}");
    expect(validateIcu(value).ok).toBe(true);

    const apostrophe = maskIcu('Delete {name}?').rebuild(new Map([[0, "Supprimer l'<ph id=\"0\"/> ?"]]));
    expect(apostrophe).toBe("Supprimer l''{name} ?");
    expect(validateIcu(apostrophe).ok).toBe(true);

    for (const message of MESSAGES) {
      const masked2 = maskIcu(message);
      const translated = new Map(masked2.units.map((unit) => [unit.id, upper(unit.text)] as [number, string]));
      const rebuilt = masked2.rebuild(translated);
      expect(validateIcu(rebuilt).ok, rebuilt).toBe(true);
      expect(diffIcuSignatures(getIcuSignature(message), getIcuSignature(rebuilt))).toEqual([]);
    }
  });

  it('rejects dropped or duplicated placeholders and changed tags', () => {
    const masked = maskIcu('Hello <b>{name}</b>');
    expect(() => masked.rebuild(new Map([[0, 'Bonjour <b></b>']]))).toThrow(/exactly once/);
    expect(() => masked.rebuild(new Map([[0, 'Bonjour <b><ph id="0"/> <ph id="0"/></b>']]))).toThrow(/exactly once/);
    expect(() => masked.rebuild(new Map([[0, 'Bonjour <i><ph id="0"/></i>']]))).toThrow(/tags/);
    expect(() => masked.rebuild(new Map([[0, 'Bonjour <ph id="7"/>']]))).toThrow(/unknown placeholder/);
  });

  it('escapes literal text so ICU reads it back unchanged', () => {
    const samples = ["l'ami {x}", '{}', "{'}", "''", "x'", "'>", "a '#' b", 'a<b>c', '5 < 6 > 4', "#1 '#'"];
    for (const text of samples) {
      for (const context of [null, 'plural']) {
        const escaped = escapeIcuText(text, context, context ? '}' : undefined);
        const message = context ? `{n, plural, other {${escaped}}}` : escaped;
        expect(validateIcu(message).ok, message).toBe(true);
        const ast: any[] = parseIcu(message);
        const nodes = context ? ast[0].options[0].children : ast;
        expect(nodes.map((node: any) => node.value).join(''), message).toBe(text);
      }
    }
  });

  it('reports ICU syntax errors and signature differences', () => {
    expect(validateIcu('Bad {name').ok).toBe(false);
    expect(validateIcu('{n, plural, one {x}}')).toMatchObject({ ok: false });
    expect(validateIcu('<b>unclosed').ok).toBe(false);
    const problems = diffIcuSignatures(getIcuSignature('Hi {name}, <b>{count}</b>'), getIcuSignature('Salut {nom}, {count}'));
    expect(problems.join(' | ')).toMatch(/missing placeholder\(s\) \{name\}/);
    expect(problems.join(' | ')).toMatch(/unknown placeholder\(s\) \{nom\}/);
    expect(problems.join(' | ')).toMatch(/tags differ/);
  });
});
