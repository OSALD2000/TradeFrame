# Architecture and implemented patterns

This document describes the code that exists. A proposal is not an implemented
pattern. The owner approves responsibility splits and new patterns before they
are introduced. The accepted runtime behavior is the reference for cleanup.

## Boundaries and folder ownership

The existing directories and file paths stay in place. An approved extraction
may add files inside an existing directory; it does not introduce a new folder
hierarchy. Packaging must include every new native module it needs.

| Location                                                                                          | Responsibility                                                                    | Boundary                                                                                                            |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/`                                                                                            | React screens, form editing, capture subscriptions and user feedback              | Calls the named preload API; no direct filesystem, credentials or Graph access                                      |
| `electron/preload.ts` and `electron/capture-types.ts`                                             | Renderer-facing commands, events and their contracts                              | Expose individual commands rather than arbitrary IPC or native capabilities                                         |
| `electron/main.ts`                                                                                | Electron startup, windows, capture state, trusted IPC and composition             | Verifies senders, owns in-memory image access and coordinates services                                              |
| `electron/form-definition.ts` and `electron/journal-layout.ts`                                    | Form definition/value rules and calendar identity                                 | Pure rules are shared without importing Electron or account services                                                |
| `electron/setup-document.ts` and the compatible `electron/form-schema.ts` facade                  | Versioned Markdown and screenshot references, with the established public exports | Document conversion depends on definitions; definitions do not depend on document conversion                        |
| `electron/journal.ts` and `electron/append-store.ts`                                              | Markdown/PNG persistence, append preservation and recovery                        | Filesystem operations validate inputs and preserve conflicting external data                                        |
| `electron/schema-store.ts`                                                                        | Versioned form definitions in SQLite                                              | Setup values and screenshots do not enter this database                                                             |
| `electron/connections.ts`                                                                         | Folder preferences and durable delivery job state                                 | Uses the connector factory; delivery failures do not undo a local save                                              |
| `electron/connector.ts`, `connector-factory.ts`, `folder-connector.ts` and `onenote-connector.ts` | Delivery contract, provider selection and delivery-specific adapters              | Constructors perform no transfer or sign-in; adapters own delivery and failure messages                             |
| `electron/onenote.ts` and `electron/onenote-content.ts`                                           | Microsoft authorization, Graph requests and validated cloud conversion            | Tokens stay native; returned HTML is parsed as data, never rendered                                                 |
| `electron/onenote-resource.ts` and `electron/onenote-error.ts`                                    | Pure resource URL validation and the shared safe error type                       | No HTTP, credentials, settings or account lifecycle; the existing public error export keeps the same class identity |
| `scripts/`                                                                                        | Native distribution, platform branding and runtime verification                   | Uses an explicit public-file allowlist                                                                              |
| `tests/`                                                                                          | Behavioral regressions using synthetic data and temporary folders                 | Does not require real journals, accounts or desktop capture                                                         |

The UI and native code share validation rules and type definitions. This is a
modular Electron application, not a claim that the current code implements a
complete Clean Architecture or is already fully separated by responsibility.
The existing persistence decisions remain in [the ADRs](adr/0001-local-first-journal.md).

## Implemented pattern inventory

### Facade: the renderer API

`CaptureAPI` in `electron/capture-types.ts` describes named
operations. `electron/preload.ts` implements that facade with
individual IPC calls and a removable state subscription.

This keeps Electron details out of React. The facade is not the security check:
`assertSender` and native argument validation in `electron/main.ts`
still enforce the boundary. Its method names, arguments and return values are
compatibility contracts. Electron's `contextBridge` is an API name, not evidence
that the application implements the GoF Bridge pattern.

Renderer consumers now declare smaller capability contracts in `capture-types.ts`:
`OneNoteBrowserAPI`, `OneNoteConnectionAPI`, `SaveDestinationsAPI`, `ConnectionsAPI`
and `SetupFormAPI`. The draft controller separately receives `SetupDraftAPI`. They use `Pick` and intersections of the existing facade;
parents retain the capabilities needed by their child components. For example,
OneNote browsing requires only `getOneNote` and `listOneNoteSetups`.

The public `CaptureAPI` and preload object are unchanged. These are compile-time
contracts, not new runtime security permissions. All 17 emitted files remain
byte-identical after this interface-only change; negative compile checks confirm
consumers cannot call unrelated commands through their declared contracts.

### Adapter: Microsoft and cloud document conversion

`OneNoteClient` in `electron/onenote.ts` adapts Microsoft device
authorization and Graph to setup operations such as listing, opening and
delivery. `electron/onenote-content.ts` converts page HTML
and attached snapshots into validated TradeFrame values and PNG references.

React does not know HTTP endpoints or token storage. Resource host validation,
scope normalization, download limits and image hashes remain part of this
adapter boundary. The current client still combines several responsibilities;
the adapter role alone does not prove single responsibility.

### Custom Hook controller and presentation

The owner approved separating `SetupForm` state and workflows from its markup.
`src/useSetupForm.ts` now owns draft state, effects, validation, save/append,
local/cloud open, replacement confirmation and form revision commands.
`src/SetupForm.tsx` retains the presentation and event-to-field bindings.

The hook accepts `SetupDraftAPI`, a narrower command contract than the view's
`SetupFormAPI`, and receives the existing field factory as an explicit dependency.
It does not import UI components. The existing hook order, state update sequence,
messages, API payloads and replacement guards remain unchanged. No memoization,
state framework or new runtime pattern was introduced.

Eight workflow tests were established against the original component before the
split. All 130 tests pass afterward, and a direct comparison of 30 view/command
states matches the previous component, including cancellation, failure, revision
migration, cloud images and generated form IDs. Native emitted files are unchanged.
These checks do not simulate a real browser or replace desktop acceptance.

### Simple Factory and connector adapters

The owner selected a factory function with small connector adapters.
`createConnector` in `connector-factory.ts` exhaustively selects a `FolderConnector`
for Obsidian/Dropbox or a `OneNoteConnector` for OneNote. Both implement the narrow
`SetupConnector` contract in `connector.ts`: deliver a source/job ID and format
its failure message. `ConnectionStore.retry` no longer dispatches by provider or
contains provider-specific error rules.

This is a **Simple Factory**, not a GoF Factory Method inheritance hierarchy or
an Abstract Factory for families of objects. There is no plugin registry or
service container. New supported destinations require explicit factory wiring
and a separate decision about their UI and persisted configuration.

The folder adapter owns the unchanged `copySnapshot` implementation; its old
export from `connections.ts` remains compatible. The OneNote adapter receives
the existing delivery callback, preserving section, notebook and job identity.
Creating an adapter does not authenticate, upload or instantiate another
`OneNoteClient`; its process-owned session is still supplied by native composition.

Delivery returns the underlying operation directly. The common return type is
`Promise<unknown>` because the queue needs completion rather than a provider's
result: folder copying still resolves to its path and OneNote resolves normally.
No wrapper `async`/`then` adds another microtask; missing callbacks and synchronous
failures keep their timing. All status transitions and persistence stay in the
queue, including legacy backup, retry filtering and cancellation behavior.

Factory tests cover both folder targets, notebook-aware/legacy OneNote delivery,
original promise identity, safe errors and unsupported destinations. A direct
comparison of 14 queue scenarios matches the previous implementation, including
immediate and awaited states, callback arguments, backups and cancellation.
All 134 tests pass; the moved folder-copy body is unchanged.

### Repository-style store: form revisions

`SchemaStore` in `electron/schema-store.ts` encapsulates
SQLite queries and exposes form revision operations. Callers do not issue SQL.
Immutable remembered revisions protect the definition embedded in older setups.

This is a concrete repository-style store, not a generic repository framework.
No base repository, ORM or dependency injection container is present. Journal
Markdown persistence remains separate from the form-definition database.

### Observer: capture state subscriptions

The native `publish` function sends `capture:changed`; `onStateChange` in preload
registers a listener and returns a void cleanup function. The
`src/capture.ts` subscribes and restores React state.

Cleanup, closed-window checks and the guard against an older initial reply are
behavioral requirements. Replacing the subscription must preserve event ordering
and must not let stale replies erase a restored draft. React hooks also use
ordinary component composition; there is no custom application-wide event bus.

### Dependency injection and a delivery strategy callback

`OneNoteClient` receives secure storage, its HTTP request function and its clock
through its constructor. Tests supply controlled implementations without
contacting Microsoft. `ConnectionStore.retry` receives a OneNote delivery
callback, while native composition supplies `deliverOneNote`.

These are explicit dependencies and a function-based delivery strategy, not a
class hierarchy. Their supplied implementations must retain return, error and
cancellation contracts. The factory selects the supported destination adapters; an unrequested plugin
registry is not introduced.

### Lazy construction at the composition root

`schemaStore`, `connectionStore` and `oneNoteClient` in
`electron/main.ts` construct and cache process-owned instances when
needed. Startup, shutdown and database close remain native concerns.

This is lazy construction rather than a global Singleton class: tests can create
independent store/client instances, and the classes do not enforce global access.

### Snapshot and versioned serialization

The owner approved splitting `form-definition.ts` (types, defaults and value
validation) from `setup-document.ts` (Markdown and screenshot references).
`form-schema.ts` remains a compatibility facade with the same 20 runtime exports
and the existing type exports. Shared low-level validation helpers are exported
only from the definition module and are not added to the compatibility facade.
There is no reverse dependency or module cycle.

All 42 original declarations retain their syntax, apart from module export
ownership. A direct comparison covers 35 validation, Markdown version 1–5 and
error cases. The existing format, append/recovery and cloud tests pass; a facade
contract test protects its export set and shared function identities.

`electron/form-schema.ts` embeds the form definition, values
and ordered screenshot references in the saved document. OneNote's
`TradeFrame.setup.json` adds the original Markdown and image hashes.

Opening restores that saved definition instead of substituting the latest form.
Older versions remain readable. This is snapshot serialization, not event
sourcing: ordinary form edits are not stored as an event history.

### Durable job queue and duplicate-aware retry

`ConnectionStore.enqueue` persists destination-specific jobs; `retry` records
individual results and runs only on explicit commands. Notebook IDs remain
pinned to jobs. Disconnecting or changing a destination cancels its pending work.

OneNote delivery searches its existing delivery marker and verifies the snapshot
and uploaded images before resuming. This limits duplicates after lost replies;
it is not an exactly-once guarantee. External removal or renaming of the marker
can allow another page. See [SYNC](SYNC.md) for the user-visible contract.

## Persistence and boundary techniques

These techniques are important, but are not additional GoF class patterns:

| Technique                    | Implementation                                                      | Contract to retain                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Publish complete files       | `append-store.createFile`; `journal.writeSetup`                     | Exclusive creation, synchronized staged bytes, no replacement of an existing note; Markdown is published after its images |
| Prepare and recover append   | `appendDocument`, `recoverAppend`, `finishAppend`                   | Keep original bytes, backups, hashes, writer ownership and crash recovery; reject conflicting changes                     |
| Atomic settings replacement  | `ConnectionStore.commit`; `OneNoteClient.atomicWrite`               | Validate before commit; retain restrictive credential permissions and safe temporary-file cleanup                         |
| Validate at trust boundaries | `assertSender`, form validators, resource validation and PNG checks | Keep origin, path, size, type, hash and redirect restrictions                                                             |
| Cancel stale work            | Native window ownership and OneNote generation checks               | Closed windows or changed accounts cannot receive an obsolete result                                                      |
| Explicit typed dispatch      | `FieldInput` and native operation branches                          | Preserve supported cases and their validation; this is not a custom Factory Method hierarchy                              |

## Applying SOLID without changing behavior

| Principle             | Current evidence and cleanup rule                                                                                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Single responsibility | Setup draft state/workflows, view markup and pure resource validation have separate modules. Native orchestration, Microsoft client ownership and form document conversion are reviewed as separate responsibilities; each further extraction is agreed before implementation. |
| Open/closed           | The delivery queue uses `SetupConnector`; provider behavior and error policy live in adapters selected by the composition factory. Domain kinds/configuration remain explicit rather than pretending arbitrary plugins are already supported.                                  |
| Liskov substitution   | Connector adapters preserve the delivery completion/failure contract. Tests exercise both implementations, original promise identity and synchronous failures; callback and facade compatibility remain intact.                                                                |
| Interface segregation | Renderer consumers receive smaller capability contracts derived from `CaptureAPI`; parent contracts compose their children's requirements. The public facade and emitted runtime remain unchanged.                                                                             |
| Dependency inversion  | HTTP, clock and secure storage are already supplied to OneNote. Native composition should wire concrete services; domain validation must not depend on Electron or the UI.                                                                                                     |

SOLID is a review discipline, not a requirement to turn every function into a
class. A short module can still have several responsibilities; a long composition
root is not automatically wrong. Changes are judged by dependency direction,
ownership and preserved contracts.

## Approved responsibility extraction

The owner approved and the code now implements the extraction of pure OneNote
resource URL validation/normalization into `electron/onenote-resource.ts`.
The shared `OneNoteError` class lives in `electron/onenote-error.ts`, retaining
its existing export from `onenote.ts`. `ConnectionStore` depends on the error
definition without importing the Microsoft client. `OneNoteClient` continues to
own HTTP and authorization.

This uses existing modular functions and explicit dependencies; it adds no new
pattern or framework. Alternatives were to keep these responsibilities in the
client or undertake the substantially larger authentication/Graph split. The
latter remains a separate owner decision.

The generation check still happens before URL validation. Error class identity,
messages, URL reconstruction, request options and size limits are preserved.
The native packaging allowlist includes both modules. Focused tests exercise the
pure parser, delegation, cancellation precedence and public error export; existing
open/retry tests remain in place. No account or file format migration is needed.

## Verification and limits

The cleanup starts from the owner-accepted 0.6.3 behavior and 119 passing tests.
Formatting is a separate commit from responsibility changes. Verify contracts
at the affected boundary, including safe failures and asynchronous races, rather
than merely updating tests to fit a new implementation.

For the formatting step in commit `2ff5c12`, all 45 original source/config/test files match the
formatter-only output. A normalized runtime syntax comparison covers 43 TS,
TSX and JS files, treating property-name quoting and adjacent JSX text fragments
as equivalent. Prettier's AST/idempotence check and all 119 tests pass. These
checks do not claim a complete proof of behavioral equivalence or a new native
acceptance on Windows/macOS. See [CODE_STYLE](CODE_STYLE.md) for the formatter.

After the approved extraction, all 122 tests pass. A direct comparison with the
previous compiled client's resource method covers 47 cases, checking exact
request URLs/headers/redirects, bytes, error types/messages and cancellation
precedence. Larger responsibility changes in native orchestration, authorization
remain separate owner decisions. React form state is now separated as described above.
