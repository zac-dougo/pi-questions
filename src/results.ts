import type { AskUserResult } from "./questions.js";

export function formatAskUserResult(result: AskUserResult): string {
	if (result.cancelled) return "User cancelled the questionnaire.";

	return result.answers
		.map((answer) => {
			const parts = [`value: ${answer.value}`];
			if (answer.note) parts.push(`note: ${answer.note}`);
			return `${answer.questionId}: ${answer.label} (${parts.join("; ")})`;
		})
		.join("\n");
}
