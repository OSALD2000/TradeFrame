import {
  MAX_SCREENSHOTS,
  validTimeframe,
  record,
  check,
  keys,
  validateSchema,
  validateValues,
  valueTags,
  DEFAULT_SCHEMA,
  JOURNAL_SCHEMA,
  journalValues,
  journalTags,
} from './form-definition';
import type { FormValues, FormSchema } from './form-definition';

export type ScreenshotReference = {
  file: string;
  caption: string;
  capturedAt: string;
  timeframe?: string;
};

export type SetupDocument = {
  schema: FormSchema;
  values: FormValues;
  createdAt: string;
  screenshots?: ScreenshotReference[];
  schemaVersion?: 2 | 3 | 4 | 5;
  journalId?: string;
};

export function validateScreenshots(
  input: unknown,
  requireTimeframe = false,
  version = 4,
  journalId?: string,
): ScreenshotReference[] {
  check(
    Array.isArray(input) && input.length > 0 && input.length <= MAX_SCREENSHOTS,
    'A setup needs 1–20 screenshots',
  );
  return input.map((item, index) => {
    check(record(item), 'Invalid screenshot metadata');
    keys(item, ['file', 'caption', 'capturedAt', 'timeframe']);
    check(item.file === screenshotFile(index, journalId), 'Invalid screenshot filename or order');
    check(
      typeof item.caption === 'string' &&
        item.caption.length <= (version >= 5 ? 20000 : 200) &&
        !(version >= 5 ? /\0/ : /[\r\n\0]/).test(item.caption),
      'Invalid screenshot caption',
    );
    check(
      typeof item.capturedAt === 'string' &&
        Number.isFinite(Date.parse(item.capturedAt)) &&
        new Date(item.capturedAt).toISOString() === item.capturedAt,
      'Invalid screenshot timestamp',
    );
    check(
      (!requireTimeframe && item.timeframe === undefined) || validTimeframe(item.timeframe),
      'Every screenshot needs a timeframe such as 1m, 2m or 1h',
    );
    return {
      file: item.file,
      caption: item.caption,
      capturedAt: item.capturedAt,
      ...(item.timeframe === undefined ? {} : { timeframe: item.timeframe as string }),
    };
  });
}

export function screenshotFile(index: number, journalId?: string): string {
  if (journalId) return `chart-${journalId}-${String(index + 1).padStart(3, '0')}.png`;
  return index === 0 ? 'chart.png' : `chart-${String(index + 1).padStart(3, '0')}.png`;
}

function renderScreenshot(shot: ScreenshotReference, index: number, version = 4): string {
  if (version >= 5)
    return `## ${shot.timeframe} · captured ${shot.capturedAt}\n\n${shot.caption ? `${shot.caption}\n\n` : ''}![Chart ${index + 1}](${shot.file})\n\n`;
  return `## Screenshot ${index + 1}${shot.timeframe ? ` · ${shot.timeframe}` : ''}\n\n![Chart ${index + 1}](${shot.file})\n\n${shot.caption ? `${shot.caption}\n\n` : ''}Captured: ${shot.capturedAt}\n\n`;
}

export function screenshotAddition(shot: ScreenshotReference, index: number, version = 4): string {
  return `\n<!-- tradeframe-screenshot: ${JSON.stringify(shot)} -->\n\n${renderScreenshot(shot, index, version)}`;
}

export const directionLabel = (value: string) =>
  value === 'notrade' ? 'No Trade' : value === 'long' ? 'Long' : 'Short';

export function serializeSetup(document: SetupDocument): string {
  const schema = validateSchema(document.schema);
  const values = validateValues(schema, document.values);
  check(
    typeof document.createdAt === 'string' &&
      Number.isFinite(Date.parse(document.createdAt)) &&
      new Date(document.createdAt).toISOString() === document.createdAt,
    'Invalid creation timestamp',
  );
  const info = journalValues(schema, values);
  const version = document.schemaVersion ?? (document.screenshots ? 5 : 2);
  const exportedTags = version === 5 ? journalTags(schema, values) : valueTags(schema, values);
  check([2, 3, 4, 5].includes(version), 'Unsupported setup version');
  const screenshots =
    document.screenshots === undefined
      ? undefined
      : validateScreenshots(document.screenshots, version >= 4, version, document.journalId);
  check(
    document.journalId === undefined ||
      (version === 5 &&
        !!info &&
        /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(document.journalId)),
    'Invalid journal identity',
  );
  check(version >= 3 === !!screenshots, 'Setup version does not match screenshot metadata');
  const metadata: Record<string, unknown> = {
    schemaVersion: version,
    createdAt: document.createdAt,
    tradeframe: {
      formatVersion: 1,
      schema,
      ...(screenshots ? { screenshots } : {}),
      ...(document.journalId ? { journalId: document.journalId } : {}),
    },
    tags: exportedTags,
  };
  for (const field of schema.fields)
    if (Object.hasOwn(values, field.id)) metadata[field.key] = values[field.id];
  if (version === 5 && info) {
    metadata.captured = screenshots![0].capturedAt.slice(0, 10);
    metadata.cssclasses = ['journal', `dir-${info.direction}`, `result-${info.result}`];
  }
  const notes = schema.fields
    .filter((field) => field.type === 'textarea' && typeof values[field.id] === 'string')
    .map((field) => `## ${field.label}\n\n${values[field.id]}\n`)
    .join('\n');
  const charts = screenshots
    ? screenshots.map((shot, index) => renderScreenshot(shot, index, version)).join('')
    : '![Chart](chart.png)\n\n';
  const title =
    version === 5 && info
      ? `${info.date}${info.time ? ` ${info.time} NY` : ''} – ${info.instrument} ${directionLabel(info.direction)} ${info.model}`
      : 'Setup';
  const markdown = `---\n${Object.entries(metadata)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(
      '\n',
    )}\n---\n\n# ${title}\n\n${charts}${exportedTags.length ? `${exportedTags.map((tag) => `#${tag}`).join(' ')}\n\n` : ''}${notes}`;
  check(new TextEncoder().encode(markdown).byteLength <= 5_000_000, 'Setup export is too large');
  return markdown;
}

function deserializeBase(markdown: string): SetupDocument {
  check(new TextEncoder().encode(markdown).byteLength <= 5_000_000, 'Markdown file is too large');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(markdown);
  check(match, 'Missing TradeFrame metadata');
  const metadata: Record<string, unknown> = Object.create(null);
  for (const line of match[1].split(/\r?\n/)) {
    const item = /^([A-Za-z][A-Za-z0-9_]*): (.+)$/.exec(line);
    check(item && !Object.hasOwn(metadata, item[1]), 'Invalid or duplicate Markdown metadata');
    metadata[item[1]] = JSON.parse(item[2]);
  }
  check(
    typeof metadata.createdAt === 'string' &&
      Number.isFinite(Date.parse(metadata.createdAt)) &&
      new Date(metadata.createdAt).toISOString() === metadata.createdAt,
    'Invalid creation timestamp',
  );
  if (metadata.schemaVersion === 1) {
    check(metadata.entryTimeZone === 'America/New_York', 'Unsupported legacy entry time zone');
    check(
      Object.keys(metadata).every((key) =>
        [
          'schemaVersion',
          'createdAt',
          'entryTimeZone',
          ...DEFAULT_SCHEMA.fields.filter((field) => field.id !== 'note').map((field) => field.key),
        ].includes(key),
      ),
      'Unknown legacy field',
    );
    const values: FormValues = Object.fromEntries(
      DEFAULT_SCHEMA.fields
        .filter((field) => field.id !== 'note')
        .map((field) => [field.id, metadata[field.key] === null ? '' : metadata[field.key]]),
    ) as FormValues;
    const notes =
      /^\r?\n# Setup\r?\n\r?\n!\[Chart\]\(chart\.png\)\r?\n\r?\n## Notes\r?\n\r?\n([\s\S]*)$/.exec(
        match[2],
      );
    check(notes, 'Unsupported legacy notes layout');
    values.note = notes[1].replace(/\r?\n$/, '');
    return {
      schema: validateSchema(DEFAULT_SCHEMA),
      values: validateValues(DEFAULT_SCHEMA, values),
      createdAt: metadata.createdAt,
    };
  }
  check(
    (metadata.schemaVersion === 2 ||
      metadata.schemaVersion === 3 ||
      metadata.schemaVersion === 4 ||
      metadata.schemaVersion === 5) &&
      record(metadata.tradeframe) &&
      metadata.tradeframe.formatVersion === 1,
    'Unsupported setup format',
  );
  keys(
    metadata.tradeframe,
    metadata.schemaVersion >= 3
      ? [
          'formatVersion',
          'schema',
          'screenshots',
          ...(metadata.schemaVersion === 5 ? ['journalId'] : []),
        ]
      : ['formatVersion', 'schema'],
  );
  const screenshots =
    metadata.schemaVersion >= 3
      ? validateScreenshots(
          metadata.tradeframe.screenshots,
          metadata.schemaVersion >= 4,
          metadata.schemaVersion,
          metadata.tradeframe.journalId as string | undefined,
        )
      : undefined;
  const schema = validateSchema(metadata.tradeframe.schema);
  check(
    Object.keys(metadata).every((key) =>
      [
        'schemaVersion',
        'createdAt',
        'tradeframe',
        'tags',
        ...(metadata.schemaVersion === 5 && schema.id === JOURNAL_SCHEMA.id
          ? ['captured', 'cssclasses']
          : []),
        ...schema.fields.map((field) => field.key),
      ].includes(key),
    ),
    'Unknown Markdown field',
  );
  const values: FormValues = Object.fromEntries(
    schema.fields
      .filter((field) => Object.hasOwn(metadata, field.key))
      .map((field) => [field.id, metadata[field.key]]),
  ) as FormValues;
  const validated = validateValues(schema, values);
  check(
    Object.keys(validated).length === Object.keys(values).length,
    'Hidden field values must not be saved',
  );
  check(
    JSON.stringify(metadata.tags) ===
      JSON.stringify(
        metadata.schemaVersion === 5
          ? journalTags(schema, validated)
          : valueTags(schema, validated),
      ),
    'Markdown tags do not match the schema values',
  );
  const document: SetupDocument = {
    schema,
    values: validated,
    createdAt: metadata.createdAt,
    ...(metadata.schemaVersion >= 3 ? { schemaVersion: metadata.schemaVersion } : {}),
    ...(screenshots ? { screenshots } : {}),
    ...(metadata.tradeframe.journalId === undefined
      ? {}
      : { journalId: metadata.tradeframe.journalId as string }),
  };
  const canonical = serializeSetup(document);
  if (metadata.schemaVersion === 5 && schema.id === JOURNAL_SCHEMA.id) {
    const info = journalValues(schema, validated)!;
    const expected = ['journal', `dir-${info.direction}`, `result-${info.result}`];
    check(
      metadata.captured === screenshots![0].capturedAt.slice(0, 10) &&
        JSON.stringify(metadata.cssclasses) === JSON.stringify(expected),
      'Journal presentation metadata does not match',
    );
  }
  const body = canonical.slice(canonical.indexOf('\n---\n') + '\n---\n'.length);
  check(
    body.replace(/\r\n/g, '\n') === match[2].replace(/\r\n/g, '\n'),
    'Markdown body does not match its field values',
  );
  return document;
}

function readWithAdditions(markdown: string, depth: number): SetupDocument {
  try {
    return deserializeBase(markdown);
  } catch (error) {
    if (depth >= MAX_SCREENSHOTS) throw error;
    const marker = markdown.lastIndexOf('\n<!-- tradeframe-screenshot: ');
    if (marker < 0) throw error;
    const addition = markdown.slice(marker);
    const header = /^\n<!-- tradeframe-screenshot: (.+) -->\n/.exec(addition);
    if (!header) throw error;
    const document = readWithAdditions(markdown.slice(0, marker), depth + 1);
    const previous = document.screenshots ?? [
      { file: 'chart.png', caption: '', capturedAt: document.createdAt },
    ];
    const screenshots = validateScreenshots(
      [...previous, JSON.parse(header[1])],
      (document.schemaVersion ?? 2) >= 4,
      document.schemaVersion,
      document.journalId,
    );
    if (
      screenshotAddition(screenshots.at(-1)!, previous.length, document.schemaVersion).replace(
        /\r\n/g,
        '\n',
      ) !== addition.replace(/\r\n/g, '\n')
    )
      throw new Error('Invalid appended screenshot');
    return { ...document, screenshots };
  }
}

export function deserializeSetup(markdown: string): SetupDocument {
  check(new TextEncoder().encode(markdown).byteLength <= 5_000_000, 'Markdown file is too large');
  return readWithAdditions(markdown.replace(/\r\n/g, '\n'), 0);
}
