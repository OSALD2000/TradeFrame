import { check, keys, record } from './form-definition';
import type { journalValues } from './form-definition';

export const FILING_FIELDS = [
  'mode',
  'year',
  'month',
  'day',
  'date',
  'time',
  'instrument',
  'session',
  'direction',
  'model',
] as const;
export type FilingField = (typeof FILING_FIELDS)[number];
export type FilingDestination = 'journal' | 'obsidian' | 'dropbox';
export type FilingRule = {
  root: string;
  folders: FilingField[];
  name: FilingField[];
  separator: ' ' | ' - ' | '_';
};
export type FilingRules = Record<FilingDestination, FilingRule>;
export type FilingValues = NonNullable<ReturnType<typeof journalValues>>;

export const DEFAULT_FILING_RULES: FilingRules = Object.fromEntries(
  (['journal', 'obsidian', 'dropbox'] as const).map((kind) => [
    kind,
    {
      root: kind === 'journal' ? '' : 'TradeFrame',
      folders: ['mode', 'year', 'month', 'day'],
      name: ['date', 'time', 'instrument', 'direction', 'model'],
      separator: ' ',
    },
  ]),
) as FilingRules;

export function safeFilingSegment(value: string, maximum = 80): string {
  let result =
    value
      .normalize('NFC')
      .replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[. ]+|[. ]+$/g, '')
      .slice(0, maximum)
      .replace(/[. ]+$/, '') || 'Untitled';
  while (new TextEncoder().encode(result).byteLength > 240 || /[\uD800-\uDBFF]$/.test(result))
    result = result.slice(0, -1);
  result = result.replace(/[. ]+$/, '') || 'Untitled';
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(result)) result = `_${result}`;
  return result;
}

export function validateFilingRule(input: unknown): FilingRule {
  check(record(input), 'Invalid filing rule');
  keys(input, ['root', 'folders', 'name', 'separator']);
  check(
    typeof input.root === 'string' &&
      (input.root === '' ||
        (input.root.length <= 80 && safeFilingSegment(input.root) === input.root)),
    'Use one safe subfolder name without path separators',
  );
  const blocks = (value: unknown, required: boolean): FilingField[] => {
    check(
      Array.isArray(value) &&
        value.length <= FILING_FIELDS.length &&
        (!required || value.length > 0),
      'Choose at least one filename block',
    );
    check(
      new Set(value).size === value.length &&
        value.every((item) => FILING_FIELDS.includes(item as FilingField)),
      'Invalid or repeated filing block',
    );
    return [...value] as FilingField[];
  };
  check([' ', ' - ', '_'].includes(input.separator as string), 'Invalid filename separator');
  return {
    root: input.root,
    folders: blocks(input.folders, false),
    name: blocks(input.name, true),
    separator: input.separator as FilingRule['separator'],
  };
}

export function validateFilingRules(input: unknown): FilingRules {
  check(record(input), 'Invalid filing rules');
  keys(input, ['journal', 'obsidian', 'dropbox']);
  return Object.fromEntries(
    (['journal', 'obsidian', 'dropbox'] as const).map((kind) => [
      kind,
      validateFilingRule(input[kind]),
    ]),
  ) as FilingRules;
}

export function filingPath(
  rule: FilingRule,
  info: FilingValues,
): { segments: string[]; filename: string } {
  const [year, month, day] = info.date.split('-');
  const fields: Record<FilingField, string> = {
    ...info,
    year,
    month,
    day,
    mode: info.mode === 'backtest' ? 'backtesting' : 'live',
    time: info.time.replace(':', ''),
    direction:
      info.direction === 'notrade' ? 'No Trade' : info.direction === 'long' ? 'Long' : 'Short',
  };
  return {
    segments: [
      ...(rule.root ? [rule.root] : []),
      ...rule.folders
        .map((field) => fields[field])
        .filter(Boolean)
        .map((value) => safeFilingSegment(value)),
    ],
    filename: `${safeFilingSegment(
      rule.name
        .map((field) => fields[field])
        .filter(Boolean)
        .join(rule.separator),
      196,
    )}.md`,
  };
}

export const FILING_EXAMPLE: FilingValues = {
  mode: 'backtest',
  date: '2026-11-01',
  time: '09:30',
  instrument: 'EURUSD',
  session: 'London',
  direction: 'long',
  model: 'FVG',
  result: 'pending',
};
