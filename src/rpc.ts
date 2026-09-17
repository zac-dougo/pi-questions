import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Answer, NormalizedQuestion } from "./questions.js";
import type { QuestionnaireOverlayResult } from "./questionnaire-overlay.js";

export async function askUserOverRpc(
	questions: readonly NormalizedQuestion[],
	ctx: ExtensionContext,
): Promise<QuestionnaireOverlayResult> {
	const answers: Answer[] = [];
	let questionIndex = 0;

	while (questionIndex < questions.length) {
		const question = questions[questionIndex]!;
		const options = question.options.map((option, index) => `${index + 1}. ${option.label}`);
		if (question.allowOther) options.push(`${question.options.length + 1}. Other...`);
		if (questionIndex > 0) options.push("← Back");

		const selected = await ctx.ui.select(`Question ${questionIndex + 1} of ${questions.length}: ${question.prompt}`, options);
		if (selected === undefined) return { answers: [], cancelled: true };
		if (selected === "← Back") {
			questionIndex--;
			continue;
		}

		const selectedIndex = options.indexOf(selected);
		if (selectedIndex < 0) return { answers: [], cancelled: true };
		if (question.allowOther && selectedIndex === question.options.length) {
			const value = (await ctx.ui.input("Your answer", "Type something..."))?.trim();
			if (!value) {
				ctx.ui.notify("Please enter an answer.", "warning");
				continue;
			}
			answers[questionIndex] = { questionId: question.id, value, label: value, isOther: true };
			questionIndex++;
			continue;
		}
		if (selectedIndex >= question.options.length) return { answers: [], cancelled: true };

		const option = question.options[selectedIndex]!;
		const note = (await ctx.ui.input("Optional note", "Press Enter to leave blank"))?.trim();
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
