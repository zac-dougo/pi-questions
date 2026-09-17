# pi-questions

A Pi extension for asking structured questions through a small, keyboard-friendly terminal UI.

## Development

Install dependencies and run the checks:

```sh
npm install
npm test
npm run typecheck
```

Load the extension for a local Pi run:

```sh
pi -e ./src/index.ts
```

When the agent needs a decision, it can call the `ask_user` tool. In TUI mode the extension opens the interactive overlay. RPC mode uses Pi's sequential `select` and `input` dialogs.

The product definition is in [`docs/spec.md`](docs/spec.md). The implementation tickets are indexed in [`docs/tickets.md`](docs/tickets.md).
