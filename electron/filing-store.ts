import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DEFAULT_FILING_RULES, validateFilingRule, validateFilingRules } from './filing-rules';
import type { FilingDestination, FilingRules } from './filing-rules';

export class FilingStore {
  private rules: FilingRules | null = null;
  constructor(private file: string) {
    try {
      const saved = JSON.parse(readFileSync(file, 'utf8'));
      if (
        saved.version !== 1 ||
        Object.keys(saved).some((key) => !['version', 'rules'].includes(key))
      )
        throw new Error('Unsupported filing preferences');
      this.rules = validateFilingRules(saved.rules);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  get(): FilingRules {
    return structuredClone(this.rules ?? DEFAULT_FILING_RULES);
  }
  snapshot(): FilingRules | null {
    return this.rules ? this.get() : null;
  }
  set(kind: FilingDestination, input: unknown): FilingRules {
    if (!['journal', 'obsidian', 'dropbox'].includes(kind))
      throw new Error('Invalid filing destination');
    const next = { ...this.get(), [kind]: validateFilingRule(input) };
    mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, JSON.stringify({ version: 1, rules: next }, null, 2), {
        flag: 'wx',
        mode: 0o600,
      });
      renameSync(temporary, this.file);
      this.rules = next;
    } finally {
      rmSync(temporary, { force: true });
    }
    return this.get();
  }
}
