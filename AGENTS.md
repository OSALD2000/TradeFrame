# Working on TradeFrame

## Start here

Read [CONTEXT](docs/CONTEXT.md) for the implemented architecture and known limits,
then [ROADMAP](docs/ROADMAP.md) for the current milestone and acceptance criteria.
Use [GLOSSARY](GLOSSARY.md) when discussing or changing domain concepts.
For UI changes, follow the approved reference lock in [DESIGN](docs/DESIGN.md).
Before changing persistence or adding integrations, read the
[local-first decision](docs/adr/0001-local-first-journal.md).
Use `package.json` as the source for commands and dependency versions.

## Scope and autonomy

Agree on a concrete work step before implementing it. Approval remains valid
through implementation, relevant tests, documentation, and routine technical
decisions within that step. Finish that work without repeated approval requests.

Agree on new features, major architectural changes, and additional dependencies
before expanding the scope. Preserve existing user changes.

Keep the solution within the agreed milestone. Reuse existing code and platform
features before adding dependencies or abstractions.

Prepare local commits using explicitly reviewed files. The owner performs pushes;
do not publish through another route. Report the result, verification limits,
commit, and remaining work when handing over.

## User data and native boundaries

Use synthetic data and temporary folders for tests and demos. Access real
journals, screenshots, or account data only when the owner explicitly scopes
that work. Keep real data and credentials out of commits, logs, and external
services. Work only in the selected project and explicitly authorized sources;
check symlink targets before following them.

Agree on a data-preservation plan before changing a persistent format. Preserve
existing text and images; validate input and paths at native/file boundaries,
and handle failures without silently overwriting data.

Keep the Electron sandbox and context isolation enabled, with Node integration
disabled in the renderer. Route necessary native operations through a narrow,
validated bridge when one is introduced. Resolve platform permission problems
without weakening these protections or changing global security settings.

## Completion criteria

Verify every agreed acceptance criterion. For code changes, run the relevant
checks from `package.json`; add a focused regression test for a bug or a test
for new non-trivial behavior. Check documentation-only edits for valid links,
consistent facts, and agreement with the source instead of rerunning app tests.

For UI changes, inspect the rendered result against [DESIGN](docs/DESIGN.md)
at desktop and narrow window sizes. A build or mocked test does not prove a
real desktop launch, visual correctness, or native behavior on another OS.
Keep blocked or unperformed checks open, explain the blocker, and give the
next verification step. Claim platform support only for behavior actually tested.

## Documentation ownership

Keep each decision in its authoritative document. Link to existing design,
roadmap, and context instead of creating competing copies. `CLAUDE.md` points
here; it does not maintain a second rule set.

Update affected documents in the same work step. Distinguish implemented,
planned, and unverified behavior. Context records the implemented state;
roadmap records planned work and acceptance; design records the approved
visual target; glossary records domain meaning only.

Write agent rules, technical documentation, UI, and commits in English. Keep
English and German READMEs aligned; discussions with the owner are in German.
Keep private learning plans and personal session notes outside this repository.

Record an ADR only for a consequential decision with real alternatives whose
reason would otherwise be lost. Use a short numbered file under `docs/adr/`,
link it from the relevant document, and update the glossary when terms change.
