# Code style and formatting

The owner approved a pinned formatter, a two-space style and incremental modular
cleanup. Formatting must not be mixed with runtime behavior changes.

## One formatter

Prettier **3.9.6** is an exact development dependency in `package.json` and
`package-lock.json`. Use the project installation; do not run an unpinned global
or automatically downloaded version. It is not a runtime dependency and is not
included in the desktop package.

`.prettierrc.json` is authoritative for formatting:

| Rule                          | Value                                                             |
| ----------------------------- | ----------------------------------------------------------------- |
| Indentation                   | Two spaces, no tabs                                               |
| JavaScript/TypeScript strings | Single quotes where possible                                      |
| Semicolons                    | Enabled                                                           |
| Print width                   | Target 100 columns, not a strict line-length limit                |
| Line endings                  | LF                                                                |
| Embedded language formatting  | Disabled to preserve embedded document/SQL/HTML template contents |

Other formatting decisions use this pinned Prettier version's defaults. JSON and
JSX retain their normal double-quote syntax. Do not add overlapping manual rules
for wrapping, commas or braces. `.editorconfig` supplies UTF-8,
LF, final newlines and two-space indentation for editors that support it.

## Commands and CI

```sh
npm ci
npm run format
npm run format:check
npm run check
```

`format` writes supported project files. `format:check` checks without rewriting.
`check` runs formatting, build/typechecking and the existing test suite. The
current Linux/Windows/macOS Check workflow already invokes `npm run check`, so
formatting failures are included in CI. No Git hooks or editor extensions are
required. An editor's format-on-save should use the project-local Prettier.

The `.prettierignore` excludes generated builds, distributions,
dependencies, runtime data, local tasks, secrets, logs, the generated lockfile
and agent instruction files. Prettier also respects the root `.gitignore`.
`AGENTS.md` and `CLAUDE.md` are policy files and were not changed by this cleanup.
Never format a user's saved Markdown/PNG journal or account configuration.

## Naming and responsibility

- Keep code, UI text, technical documentation and commits in English. Keep both
  READMEs aligned; discussion with the owner remains German.
- Preserve existing exported names and file paths unless a specific change is
  agreed. Use the established domain terms in [GLOSSARY](../GLOSSARY.md).
- Prefer the existing function/component/class style where it fits. Use explicit
  dependencies and small capability types at real boundaries, not empty wrappers
  or inheritance added only to resemble a pattern.
- Put validation at the native and persistence boundaries. UI validation is
  feedback, not a replacement for native validation.
- Explain a non-obvious reason or limitation in a comment; do not narrate code
  that is already clear. Preserve useful existing explanations and known limits.
- Keep the folder structure. New files within it need an approved responsibility
  split and corresponding tests/package inclusion.

Implemented patterns and pending decisions belong in
[ARCHITECTURE](ARCHITECTURE.md). User-visible persistence and sync behavior remain
in [JOURNAL](JOURNAL.md) and [SYNC](SYNC.md); do not duplicate those specifications.

## Refactoring workflow

1. Start from a clean, passing baseline and inspect every affected caller.
2. Propose the concrete responsibility, dependency and pattern decision to the
   owner before implementing a structural change.
3. Keep formatting in its own commit. Do not change user messages, formats,
   ordering, error handling, capture timing or authentication as part of cleanup.
4. Check before/after behavior with synthetic data, including relevant failure
   and cancellation cases. Add a regression where existing checks leave a gap.
5. Run `npm run check`, inspect the diff and verify that no existing path or
   directory moved. New native modules must enter the packaging allowlist.

Passing tests do not prove that every possible behavior is identical. Native
desktop and account acceptance remain separate evidence. An Electron API upgrade
or feature change is a separate decision, even when encountered during cleanup.

The formatter was obtained from the existing integrity-checked npm cache because
registry DNS was unavailable in the execution environment. The committed lockfile
uses the public npm registry URL and verified integrity, not a local `/tmp` path.
An isolated offline `npm ci` verifies that formatter lock entry.

References: [Prettier configuration](https://prettier.io/docs/configuration),
[installation and pinning](https://prettier.io/docs/install),
[CLI checks](https://prettier.io/docs/cli).
