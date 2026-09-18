import { strict as assert } from "node:assert";
import test from "node:test";
import { normalizeQuestions } from "../src/questions.js";
import { askUserOverRpc, type RpcQuestionUI } from "../src/rpc.js";

function createUI(selections: Array<string | undefined>, inputs: Array<string | undefined>): RpcQuestionUI {
	return {
		select: async (_title, _options) => selections.shift(),
		input: async (_title, _placeholder) => inputs.shift(),
		notify: () => {},
	};
}

test("puts the recommended RPC choice first", async () => {
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
	let shownOptions: string[] = [];
	const ui: RpcQuestionUI = {
		select: async (_title, options) => {
			shownOptions = options;
			return undefined;
		},
		input: async () => undefined,
		notify: () => {},
	};

	await askUserOverRpc(questions, ui);

	assert.equal(shownOptions[0], "2. Robust");
});

test("answers preset RPC choices and an optional note", async () => {
	const questions = normalizeQuestions({
		questions: [
			{
				id: "scope",
				prompt: "What is in scope?",
				options: [{ value: "repo", label: "Repository", recommended: true }],
			},
		],
	});

	const result = await askUserOverRpc(questions, createUI(["1. Repository"], ["include docs"]));

	assert.deepEqual(result, {
		cancelled: false,
		answers: [{ questionId: "scope", value: "repo", label: "Repository", note: "include docs", isOther: false }],
	});
});

test("cancelling an RPC dialog discards answers", async () => {
	const questions = normalizeQuestions({
		questions: [
			{
				id: "scope",
				prompt: "What is in scope?",
				options: [{ value: "repo", label: "Repository" }],
			},
			{
				id: "tests",
				prompt: "Run tests?",
				options: [{ value: "yes", label: "Yes" }],
			},
		],
	});

	const result = await askUserOverRpc(questions, createUI(["1. Repository", undefined], []));

	assert.deepEqual(result, { answers: [], cancelled: true });
});
