# Pi questions spec

Status: draft

## Problem

Pi agents often need an answer before they can continue. A plain text question makes the user type more than necessary and gives the agent an answer that is harder to interpret. The extension should let the agent present a short list of choices while still leaving room for a written answer or a note.

## Goal

Add one custom Pi tool that lets the agent ask one or more structured questions in a compact terminal popup.

The first version targets Pi's interactive TUI mode. It should feel like one conversation with the agent, not like a separate form application.

## Non-goals for v1

- Persistent question drafts across Pi restarts.
- Branching questions whose later questions depend on earlier answers.
- Editing an earlier question after moving forward.
- Mouse-specific behavior.
- A second UI protocol for RPC clients.
- Automatic extraction of questions from agent text.

## User experience

### Opening

The agent calls `ask_user` with one or more questions. Pi opens a centered, bounded overlay over the current terminal content. The overlay shows:

- a title such as `Agent question`;
- progress, such as `Question 2 of 4`;
- the current question text;
- the available answer choices;
- an `Other...` choice when free text is allowed;
- an optional note attached to the selected choice; and
- a short help line for the active keys.

The overlay stays open until the user completes all questions or cancels it.

### Answering a question

- `Up` and `Down` move through the choices.
- `Enter` selects the highlighted choice and moves to the next question.
- `Tab` while a normal choice is highlighted opens an inline note field for that choice. The choice remains selected.
- In note mode, printable keys edit the note, `Backspace` removes text, and `Left`/`Right` move the cursor.
- `Enter` in note mode saves the note and moves to the next question.
- `Escape` in note mode closes note mode without saving the current edit.
- `Other...` enters free-text mode. `Enter` saves the written answer and moves to the next question.
- `Escape` in free-text mode returns to the choices without saving.
- `Escape` from the choices cancels the complete questionnaire.

A note is optional. A free-text `Other...` answer must contain at least one non-whitespace character before it can be submitted.

After the last question is answered, the overlay closes and the tool returns every answer to the agent in question order.

### Multiple questions

Questions are shown one at a time. The next question appears immediately after the current answer is submitted. The user cannot jump ahead or go back in v1. The progress indicator makes the remaining work visible.

If the user cancels, the tool returns the answers already submitted plus a cancellation flag. The agent can decide whether to continue, ask again, or stop.

## Tool contract

Tool name: `ask_user`

The tool accepts an ordered list of questions:

```ts
interface AskUserInput {
  questions: Question[];
}

interface Question {
  id: string;
  prompt: string;
  options: Option[];
  allowOther?: boolean; // defaults to true
}

interface Option {
  value: string;
  label: string;
  description?: string;
}
```

Requirements:

- `id` is unique within the request and is returned unchanged.
- `prompt` is the question displayed to the user.
- `value` is the stable value sent to the agent. `label` is display text.
- `description` is optional supporting text.
- `options` must contain at least one option.
- `allowOther` defaults to `true`. When false, the UI does not show `Other...`.
- An empty question list is invalid.

The result is:

```ts
interface AskUserResult {
  answers: Answer[];
  cancelled: boolean;
}

interface Answer {
  questionId: string;
  value: string;
  label: string;
  note?: string;
  isOther: boolean;
}
```

For an `Other...` answer, `value` and `label` contain the user's text and `isOther` is `true`. For a preset choice, `value` and `label` come from the selected option and `isOther` is `false`. `note` is present only when the user entered non-whitespace note text.

The tool result sent to the agent should be concise but include the question id, selected value, and note when present. The structured result belongs in `details` so the renderer and session restoration can use it.

## TUI design

Use Pi's `ctx.ui.custom()` with `{ overlay: true }` in TUI mode. Use Pi's theme passed to the custom component and `matchesKey()` for input handling.

The component owns a small state machine:

```text
choices
  ├─ Enter on preset ──> save answer ──> next question or done
  ├─ Tab on preset ────> note
  ├─ Enter on Other ───> free text
  └─ Escape ───────────> cancelled

note
  ├─ Enter ─────────────> save note and answer ──> next question or done
  └─ Escape ───────────> choices

free text
  ├─ Enter with text ──> save answer ──> next question or done
  └─ Escape ───────────> choices
```

Use a small custom component around Pi's existing input primitives where they fit. The component must:

- keep the selected choice and text cursor visible;
- request a render after every state change;
- wrap and truncate text so every rendered line fits the available width;
- handle narrow terminals without throwing; and
- release all overlay state when it closes.

Suggested overlay defaults are a width of 60 columns, a maximum height of 80% of the terminal, and a centered anchor. The overlay must remain usable when the terminal is narrower than the preferred width.

## Modes and cancellation

- TUI mode supports the full overlay and key behavior.
- Print and JSON modes cannot ask a person. The tool returns an error result without pretending that an answer was selected.
- RPC mode is not part of v1 because Pi's RPC UI protocol does not expose `ctx.ui.custom()`. A later version may provide a sequential combination of `select` and `input`, or define a client-side questionnaire protocol.
- Aborting Pi while the tool is open must close the overlay and return cancellation rather than leave the tool promise pending.

## Agent-facing guidance

The tool description should tell the agent to use `ask_user` when it needs a decision, preference, clarification, or confirmation that benefits from explicit choices. The agent should provide short labels, useful descriptions, stable ids, and only the choices that materially differ.

The agent should ask multiple independent questions in one call when it needs answers together. It should use one question when a later question depends on the answer to an earlier question, because branching is outside v1.

## Rendering after completion

The tool call renderer shows the question count and prompts without dumping the whole form. The result renderer shows each completed answer in order:

```text
✓ scope: repository (note: include documentation files)
✓ tests: run the full suite
```

A cancelled result shows `Cancelled` and the submitted answers when there are any.

## Acceptance criteria

1. An agent can call `ask_user` with one question and receive a preset answer.
2. The user can navigate choices with Up and Down and select with Enter.
3. Tab on a preset choice opens a note field, and the note is returned with that answer.
4. `Other...` accepts a typed answer and returns it as `isOther: true`.
5. A multi-question request shows exactly one question at a time and advances after each submitted answer.
6. Escape cancels from choices and returns partial answers with `cancelled: true`.
7. Escape from note or free-text mode returns to choices without saving the in-progress text.
8. The UI remains within its overlay bounds and handles long prompts, descriptions, and narrow terminals.
9. Invalid tool input produces a clear tool error and does not open the overlay.
10. Non-TUI execution returns a clear unsupported-mode result.
11. The final result is available both as concise agent-readable text and structured `details`.

## Open decisions

These need confirmation before implementation:

1. Should `Other...` be enabled by default, or should the agent opt in with `allowOther: true`?
2. Should `Tab` on a selected choice always enter note mode, or should a second `Tab` cycle to the next question when notes are not wanted?
3. Should users be able to go back to earlier questions with `Shift+Tab` or a dedicated key?
4. Should cancellation return partial answers to the agent, or discard them and return only `cancelled: true`?
5. Should v1 support Pi RPC clients through a degraded `select`/`input` flow?
6. What name should the tool and project use: `ask_user`, `questionnaire`, or another name?
