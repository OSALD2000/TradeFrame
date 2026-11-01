import { createHash } from 'node:crypto';
import {
  DEFAULT_SCHEMA,
  JOURNAL_SCHEMA,
  deserializeSetup,
  emptyValues,
  validateValues,
  journalValues,
  validTimeframe,
  MAX_SCREENSHOTS,
} from './form-schema';
import type { FormSchema, FormValues } from './form-schema';
import type { Screenshot, SetupInput } from './capture-types';
import { pngBytes } from './journal';

export const snapshotName = 'TradeFrame.setup.json';
export const imageAlt = (index: number) => `TradeFrame screenshot ${index + 1}`;
export const imageHash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const entities: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
};
function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (entity, name: string) => {
    if (name[0] !== '#') return entities[name.toLowerCase()] ?? entity;
    const value =
      name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff)
      ? String.fromCodePoint(value)
      : entity;
  });
}
export function pageText(html: string) {
  return decode(
    html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
      .replace(/<br\s*\/?\s*>|<\/(?:p|h[1-6]|div|li)\s*>/gi, '\n')
      .replace(/<[^>]*>/g, ''),
  ).trim();
}
// Read only the quoted resource attributes emitted by OneNote; never render its HTML.
export function assets(html: string, tag: 'img' | 'object'): Record<string, string>[] {
  return [...html.matchAll(new RegExp(`<${tag}\\b(?:[^>"']|"[^"]*"|'[^']*')*>`, 'gi'))].map(
    (match) => {
      const attributes: Record<string, string> = {};
      for (const attribute of match[0].matchAll(/([a-z][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
        const name = attribute[1].toLowerCase();
        if (Object.hasOwn(attributes, name))
          throw new Error('Duplicate OneNote resource attribute');
        attributes[name] = decode(attribute[2] ?? attribute[3]);
      }
      return attributes;
    },
  );
}
export type CloudSetup = SetupInput & { screenshots: Screenshot[]; legacy: boolean };
export async function restoreOneNote(
  html: string,
  download: (url: string, limit: number) => Promise<Buffer>,
): Promise<CloudSetup> {
  if (Buffer.byteLength(html) > 5_000_000) throw new Error('OneNote page content is too large');
  const attachments = assets(html, 'object').filter(
    (item) => item['data-attachment'] === snapshotName,
  );
  const images = assets(html, 'img');
  if (attachments.length > 1) throw new Error('Multiple TradeFrame snapshots found');
  if (attachments.length === 1) {
    const saved = JSON.parse((await download(attachments[0].data, 5_000_000)).toString('utf8'));
    if (
      saved?.formatVersion !== 1 ||
      typeof saved.markdown !== 'string' ||
      !Array.isArray(saved.images) ||
      !saved.images.every(
        (hash: unknown) => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash),
      )
    )
      throw new Error('Invalid TradeFrame snapshot');
    const document = deserializeSetup(saved.markdown);
    const references = document.screenshots ?? [
      { caption: '', capturedAt: document.createdAt, timeframe: '' },
    ];
    if (saved.images.length !== references.length) throw new Error('Snapshot image count differs');
    let total = 0;
    const screenshots: Screenshot[] = [];
    for (const [index, reference] of references.entries()) {
      const matching = images.filter((item) => item.alt === imageAlt(index));
      if (matching.length !== 1)
        throw new Error(
          'This OneNote setup has missing or duplicated screenshots. Retry its delivery first.',
        );
      const bytes = await download(matching[0]['data-fullres-src'], 32_000_000);
      total += bytes.length;
      if (total > 128_000_000 || imageHash(bytes) !== saved.images[index])
        throw new Error('A OneNote screenshot differs from the saved TradeFrame snapshot');
      const image = `data:image/png;base64,${bytes.toString('base64')}`;
      pngBytes(image);
      screenshots.push({
        id: `onenote-${index}`,
        image,
        caption: reference.caption,
        capturedAt: reference.capturedAt,
        timeframe: reference.timeframe ?? '',
      });
    }
    return { schema: document.schema, values: document.values, screenshots, legacy: false };
  }
  if (!images.length || images.length > MAX_SCREENSHOTS)
    throw new Error('This page is not a supported TradeFrame setup');
  const sections = [
    ...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2\s*>([\s\S]*?)(?=<h2\b|<\/body>|$)/gi),
  ];
  const fieldSections = sections.filter((part) => !/^Screenshot \d+ · /.test(pageText(part[1])));
  const valuesByLabel = new Map(
    fieldSections.map((part) => [
      pageText(part[1]),
      pageText(part[2].match(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/i)?.[1] ?? part[2]),
    ]),
  );
  let schema: FormSchema = {
    formatVersion: 1,
    id: 'onenote_import',
    revision: 1,
    name: 'OneNote import',
    fields: [
      {
        id: 'note',
        key: 'note',
        label: 'Original OneNote text',
        type: 'textarea',
        required: false,
        tags: [],
      },
    ],
  };
  let values: FormValues = {
    note: pageText(html.replace(/<head\b[^>]*>[\s\S]*?<\/head\s*>/gi, '')),
  };
  if (String(values.note).length > 20_000)
    throw new Error('Legacy page text is too long to import without truncation');
  for (const candidate of [JOURNAL_SCHEMA, DEFAULT_SCHEMA]) {
    if (
      valuesByLabel.size !== fieldSections.length ||
      ![...valuesByLabel.keys()].every((label) =>
        candidate.fields.some((field) => field.label === label),
      )
    )
      continue;
    try {
      const input = emptyValues(candidate);
      for (const field of candidate.fields) {
        if (!valuesByLabel.has(field.label)) continue;
        const value = valuesByLabel.get(field.label)!;
        input[field.id] =
          field.type === 'number'
            ? value === ''
              ? null
              : Number(value)
            : field.type === 'checkbox'
              ? value === 'true'
              : field.type === 'multiselect'
                ? value
                  ? value.split(', ')
                  : []
                : value;
      }
      const checked = validateValues(candidate, input);
      journalValues(candidate, checked);
      // Preserve all legacy paragraphs in Notes while recovering the original typed fields.
      schema = candidate;
      values = { ...checked, note: values.note };
      break;
    } catch {
      /* Unknown older forms remain a complete text import. */
    }
  }
  let total = 0;
  const screenshots: Screenshot[] = [];
  for (const [index, resource] of images.entries()) {
    const part = sections.find((entry) =>
      pageText(entry[1]).startsWith(`Screenshot ${index + 1} · `),
    );
    const timeframe = part ? pageText(part[1]).split(' · ').slice(1).join(' · ') : '';
    const caption = part ? pageText(part[2].split(/<img\b/i)[0]) : '';
    const timestamp = part
      ? pageText(part[2]).match(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/)?.[0]
      : undefined;
    const bytes = await download(resource['data-fullres-src'], 32_000_000);
    total += bytes.length;
    if (total > 128_000_000 || caption.length > 20_000)
      throw new Error('Legacy setup is too large');
    const image = `data:image/png;base64,${bytes.toString('base64')}`;
    pngBytes(image);
    if (timestamp && !Number.isFinite(Date.parse(timestamp)))
      throw new Error('Invalid legacy screenshot date');
    screenshots.push({
      id: `onenote-${index}`,
      image,
      caption,
      capturedAt: timestamp ?? new Date().toISOString(),
      timeframe: validTimeframe(timeframe) ? timeframe : '',
    });
  }
  return { schema, values, screenshots, legacy: true };
}
