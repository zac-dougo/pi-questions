import { strict as assert } from "node:assert";
import test from "node:test";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { normalizeQuestions } from "../src/questions.js";
import { visibleWidth } from "@earendil-works/pi-tui";
import { QuestionnaireOverlay } from "../src/questionnaire-overlay.js";

type TestTheme = Pick<Theme, "fg" | "bg" | "bold">;

const theme: TestTheme = {
	fg: (_color, text) => text,
	bg: (_color, text) => text,
	bold: (text) => text,
};

test("completes through terminal key input", () => {
	const questions = normalizeQuestions({
		questions: [
			{
				id: "scope",
				prompt: "Scope?",
				allowOther: false,
				options: [{ value: "repo", label: "Repository", recommended: true }],
			},
		],
	});
	let completed = false;
	const overlay = new QuestionnaireOverlay(questions, theme, (result) => {
		completed = !result.cancelled && result.answers.length === 1;
	});

	overlay.handleInput("\r");

	assert.equal(completed, true);
	assert.equal(overlay.getState().status, "complete");
});

test("renders long content within the available width", () => {
	const questions = normalizeQuestions({
		questions: [
			{
				id: "scope",
				prompt: "A very long question that needs to wrap across several lines",
				options: [
					{
						value: "repo",
						label: "A very long repository choice",
						description: "A supporting description that also needs wrapping",
					},
				],
			},
		],
	});
	const overlay = new QuestionnaireOverlay(questions, theme, () => {});

	assert.ok(overlay.render(20).every((line) => visibleWidth(line) <= 20));
});

test("renders the current question and recommended choice", () => {
	const questions = normalizeQuestions({
		questions: [
			{
				id: "scope",
				prompt: "What should be included?",
				allowOther: false,
				options: [
					{ value: "repo", label: "Repository" },
					{ value: "docs", label: "Repository and docs", recommended: true },
				],
			},
		],
	});
	const overlay = new QuestionnaireOverlay(questions, theme, () => {});

	const lines = overlay.render(50);

	assert.ok(lines.some((line) => line.includes("Question 1 of 1")));
	assert.ok(lines.some((line) => line.includes("What should be included?")));
	assert.ok(lines.some((line) => line.includes("> 2. Repository and docs")));
});
