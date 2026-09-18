import type { Answer, NormalizedQuestion } from "./questions.js";

export interface RpcQuestionUI {
	select(title: string, options: string[]): Promise<string | undefined>;
	input(title: string, placeholder?: string): Promise<string | undefined>;
	notify(message: string, type?: "info" | "warning" | "error"): void;
}
import type { QuestionnaireOverlayResult } from "./questionnaire-overlay.js";

export async function askUserOverRpc(
	questions: readonly NormalizedQuestion[],
	ui: RpcQuestionUI,
): Promise<QuestionnaireOverlayResult> {
	const answers: Answer[] = [];
	let questionIndex = 0;

	while (questionIndex < questions.length) {
		const question = questions[questionIndex]!;
		const orderedOptions = [
			...question.options
				.map((option, index) => ({ option, index }))
				.filter(({ option }) => option.recommended === true),
			...question.options
				.map((option, index) => ({ option, index }))
				.filter(({ option }) => option.recommended !== true),
		];
		const options = orderedOptions.map(({ option, index }) => `${index + 1}. ${option.label}`);
		if (question.allowOther) options.push(`${question.options.length + 1}. Other...`);
		if (questionIndex > 0) options.push("← Back");

		const selected = await ui.select(`Question ${questionIndex + 1} of ${questions.length}: ${question.prompt}`, options);
		if (selected === undefined) return { answers: [], cancelled: true };
		if (selected === "← Back") {
			questionIndex--;
			continue;
		}

		const selectedIndex = options.indexOf(selected);
		if (selectedIndex < 0) return { answers: [], cancelled: true };
		if (question.allowOther && selectedIndex === orderedOptions.length) {
			const value = (await ui.input("Your answer", "Type something..."))?.trim();
			if (!value) {
				ui.notify("Please enter an answer.", "warning");
				continue;
			}
			answers[questionIndex] = { questionId: question.id, value, label: value, isOther: true };
			questionIndex++;
			continue;
		}
		const orderedOption = orderedOptions[selectedIndex];
		if (!orderedOption) return { answers: [], cancelled: true };

		const option = orderedOption.option;
		const note = (await ui.input("Optional note", "Press Enter to leave blank"))?.trim();
		if (note === undefined) return { answers: [], cancelled: true };
		answers[questionIndex] = {
			questionId: question.id,
			value: option.value,
			label: option.label,
			...(note ? { note } : {}),
			isOther: false,
		};
		questionIndex++;
	}

	return { answers, cancelled: false };
}
