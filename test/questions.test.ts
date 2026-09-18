import { strict as assert } from "node:assert";
import test from "node:test";
import { normalizeQuestions } from "../src/questions.js";
import { formatAskUserResult } from "../src/results.js";
import { createQuestionnaireState, transitionQuestionnaire } from "../src/questionnaire.js";

test("formats completed answers for the agent", () => {
	assert.equal(
		formatAskUserResult({
			answers: [
				{ questionId: "scope", value: "repo", label: "Repository", note: "include docs", isOther: false },
			],
			cancelled: false,
		}),
		"scope: Repository (value: repo; note: include docs)",
	);
});

test("formats cancellation without answers", () => {
	assert.equal(formatAskUserResult({ answers: [], cancelled: true }), "User cancelled the questionnaire.");
});

test("highlights the recommended option initially", () => {
	const questions = normalizeQuestions({
		questions: [
			{
				id: "approach",
				prompt: "Which approach should we use?",
				options: [
					{ value: "simple", label: "Simple" },
					{ value: "robust", label: "Robust", recommended: true },
				],
			},
		],
	});

	assert.equal(questions[0]?.initialOptionIndex, 1);
});

test("starts at the recommended option", () => {
	const questions = normalizeQuestions({
		questions: [
			{
				id: "approach",
				prompt: "Which approach?",
				options: [
					{ value: "simple", label: "Simple" },
					{ value: "robust", label: "Robust", recommended: true },
				],
			},
		],
	});

	const state = createQuestionnaireState(questions);

	assert.equal(state.status, "active");
	assert.equal(state.questionIndex, 0);
	assert.equal(state.selectedOptionIndex, 1);
	assert.equal(state.mode, "choices");
});

test("moves through options with Up and Down", () => {
	const state = createQuestionnaireState(
		normalizeQuestions({
			questions: [
				{
					id: "approach",
					prompt: "Which approach?",
					options: [
						{ value: "one", label: "One" },
						{ value: "two", label: "Two", recommended: true },
						{ value: "three", label: "Three" },
					],
				},
			],
		}),
	);

	const down = transitionQuestionnaire(state, { type: "down" });
	assert.equal(down.selectedOptionIndex, 2);
	assert.equal(transitionQuestionnaire(down, { type: "up" }).selectedOptionIndex, 1);
});

test("submits a preset answer and advances", () => {
	const state = createQuestionnaireState(
		normalizeQuestions({
			questions: [
				{
					id: "approach",
					prompt: "Which approach?",
					options: [{ value: "simple", label: "Simple", recommended: true }],
				},
				{
					id: "tests",
					prompt: "Run tests?",
					options: [{ value: "yes", label: "Yes", recommended: true }],
				},
			],
		}),
	);

	const next = transitionQuestionnaire(state, { type: "enter" });
	assert.equal(next.questionIndex, 1);
	assert.deepEqual(next.answers, [
		{ questionId: "approach", value: "simple", label: "Simple", isOther: false },
	]);
});

test("adds an optional note to a preset answer", () => {
	const state = createQuestionnaireState(
		normalizeQuestions({
			questions: [
				{
					id: "scope",
					prompt: "What is in scope?",
					options: [{ value: "repo", label: "Repository", recommended: true }],
				},
			],
		}),
	);

	const noteMode = transitionQuestionnaire(state, { type: "tab" });
	assert.equal(noteMode.mode, "note");
	const typed = transitionQuestionnaire(noteMode, { type: "text", text: "include docs" });
	assert.equal(typed.inputCursor, 12);
	const complete = transitionQuestionnaire(typed, { type: "enter" });
	assert.equal(complete.status, "complete");
	assert.deepEqual(complete.answers[0], {
		questionId: "scope",
		value: "repo",
		label: "Repository",
		note: "include docs",
		isOther: false,
	});
});

test("leaves note mode without saving on Escape", () => {
	const state = createQuestionnaireState(
		normalizeQuestions({
			questions: [
				{
					id: "scope",
					prompt: "What is in scope?",
					options: [{ value: "repo", label: "Repository" }],
				},
			],
		}),
	);

	const noteMode = transitionQuestionnaire(state, { type: "tab" });
	const edited = transitionQuestionnaire(noteMode, { type: "text", text: "discard me" });
	const choices = transitionQuestionnaire(edited, { type: "escape" });
	assert.equal(choices.mode, "choices");
	assert.equal(choices.inputText, "");
	assert.deepEqual(choices.answers, []);
});

test("submits a non-empty Other answer", () => {
	const state = createQuestionnaireState(
		normalizeQuestions({
			questions: [
				{
					id: "format",
					prompt: "Which format?",
					options: [{ value: "json", label: "JSON" }],
				},
			],
		}),
	);

	const other = transitionQuestionnaire(transitionQuestionnaire(state, { type: "down" }), { type: "enter" });
	assert.equal(other.mode, "free-text");
	const typed = transitionQuestionnaire(other, { type: "text", text: "YAML" });
	const complete = transitionQuestionnaire(typed, { type: "enter" });
	assert.equal(complete.status, "complete");
	assert.deepEqual(complete.answers[0], {
		questionId: "format",
		value: "YAML",
		label: "YAML",
		isOther: true,
	});
});

test("keeps Other mode open for a blank answer", () => {
	const state = createQuestionnaireState(
		normalizeQuestions({
			questions: [
				{
					id: "format",
					prompt: "Which format?",
					options: [{ value: "json", label: "JSON" }],
				},
			],
		}),
	);

	const other = transitionQuestionnaire(transitionQuestionnaire(state, { type: "down" }), { type: "enter" });
	const stillEditing = transitionQuestionnaire(other, { type: "enter" });
	assert.equal(stillEditing.status, "active");
	assert.equal(stillEditing.mode, "free-text");
	assert.deepEqual(stillEditing.answers, []);
});

test("returns to the previous question with its answer restored", () => {
	const state = createQuestionnaireState(
		normalizeQuestions({
			questions: [
				{
					id: "first",
					prompt: "First?",
					options: [{ value: "one", label: "One", recommended: true }],
				},
				{
					id: "second",
					prompt: "Second?",
					options: [
						{ value: "a", label: "A" },
						{ value: "b", label: "B", recommended: true },
					],
				},
				{
					id: "third",
					prompt: "Third?",
					options: [{ value: "three", label: "Three", recommended: true }],
				},
			],
		}),
	);

	const second = transitionQuestionnaire(state, { type: "enter" });
	const third = transitionQuestionnaire(second, { type: "enter" });
	const restored = transitionQuestionnaire(third, { type: "left" });
	assert.equal(restored.questionIndex, 1);
	assert.equal(restored.selectedOptionIndex, 1);
	assert.deepEqual(restored.answers.map((answer) => answer.questionId), ["first", "second"]);
});

test("cancels and discards submitted answers", () => {
	const state = createQuestionnaireState(
		normalizeQuestions({
			questions: [
				{
					id: "first",
					prompt: "First?",
					options: [{ value: "one", label: "One", recommended: true }],
				},
				{
					id: "second",
					prompt: "Second?",
					options: [{ value: "two", label: "Two", recommended: true }],
				},
			],
		}),
	);

	const second = transitionQuestionnaire(state, { type: "enter" });
	const cancelled = transitionQuestionnaire(second, { type: "escape" });
	assert.equal(cancelled.status, "cancelled");
	assert.deepEqual(cancelled.answers, []);
});

test("edits note text at the cursor", () => {
	const state = createQuestionnaireState(
		normalizeQuestions({
			questions: [
				{
					id: "scope",
					prompt: "Scope?",
					options: [{ value: "repo", label: "Repository" }],
				},
			],
		}),
	);

	const note = transitionQuestionnaire(state, { type: "tab" });
	const typed = transitionQuestionnaire(note, { type: "text", text: "ac" });
	const inserted = transitionQuestionnaire(transitionQuestionnaire(typed, { type: "left" }), {
		type: "text",
		text: "b",
	});
	const deleted = transitionQuestionnaire(inserted, { type: "backspace" });
	assert.equal(deleted.inputText, "ac");
	assert.equal(deleted.inputCursor, 1);
});

test("rejects duplicate question ids", () => {
	assert.throws(
		() =>
			normalizeQuestions({
				questions: [
					{ id: "same", prompt: "First", options: [{ value: "one", label: "One" }] },
					{ id: "same", prompt: "Second", options: [{ value: "two", label: "Two" }] },
				],
			}),
		/duplicate question id: same/,
	);
});

test("rejects an empty question list", () => {
	assert.throws(() => normalizeQuestions({ questions: [] }), /at least one question/);
});

test("rejects a question without options", () => {
	assert.throws(
		() => normalizeQuestions({ questions: [{ id: "empty", prompt: "Pick one", options: [] }] }),
		/at least one option/,
	);
});

test("rejects multiple recommended options", () => {
	assert.throws(
		() =>
			normalizeQuestions({
				questions: [
					{
						id: "approach",
						prompt: "Which approach?",
						options: [
							{ value: "one", label: "One", recommended: true },
							{ value: "two", label: "Two", recommended: true },
						],
					},
				],
			}),
			/recommends at most one option/,
	);
});

test("defaults to the first option and allows Other", () => {
	const [question] = normalizeQuestions({
		questions: [{ id: "choice", prompt: "Pick one", options: [{ value: "one", label: "One" }] }],
	});

	assert.equal(question?.initialOptionIndex, 0);
	assert.equal(question?.allowOther, true);
});
