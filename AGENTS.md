# Project instructions

## Before changing code

- Read `docs/spec.md`. It is the source of truth for the question tool's behavior.
- Treat Pi's extension APIs and `@earendil-works/pi-tui` as the platform. Prefer the built-in components and key matching helpers over terminal escape sequences.
- Keep the first implementation small. Do not add a dependency unless the spec or a failing test requires it.

## UI behavior

- The main interaction is a TUI overlay opened by a custom tool.
- Keep keyboard behavior explicit and testable. Use `matchesKey()` and call `tui.requestRender()` after state changes.
- Every rendered line must fit the width passed to `render()`.

## Documentation

- Record settled behavior in `docs/spec.md` before implementing it.
- Keep open decisions in the spec until they are resolved. Do not quietly invent behavior in code.
