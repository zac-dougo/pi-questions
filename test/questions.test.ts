import { strict as assert } from "node:assert";
import test from "node:test";
import { normalizeQuestions } from "../src/questions.js";

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
