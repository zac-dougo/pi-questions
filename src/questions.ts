import { Type, type Static } from "typebox";

export const OptionSchema = Type.Object({
	value: Type.String(),
	label: Type.String(),
	description: Type.Optional(Type.String()),
	recommended: Type.Optional(Type.Boolean()),
});

export const QuestionSchema = Type.Object({
	id: Type.String(),
	prompt: Type.String(),
	options: Type.Array(OptionSchema),
	allowOther: Type.Optional(Type.Boolean()),
});

export const AskUserInputSchema = Type.Object({
	questions: Type.Array(QuestionSchema),
});

export type AskUserInput = Static<typeof AskUserInputSchema>;
export type QuestionInput = Static<typeof QuestionSchema>;
export type OptionInput = Static<typeof OptionSchema>;

export interface NormalizedQuestion extends QuestionInput {
	allowOther: boolean;
	initialOptionIndex: number;
}

export function normalizeQuestions(input: AskUserInput): NormalizedQuestion[] {
	if (input.questions.length === 0) throw new Error("at least one question is required");

	const ids = new Set<string>();
	for (const question of input.questions) {
		if (ids.has(question.id)) throw new Error(`duplicate question id: ${question.id}`);
		if (question.options.length === 0) throw new Error(`at least one option is required: ${question.id}`);
		if (question.options.filter((option) => option.recommended === true).length > 1) {
			throw new Error(`recommends at most one option: ${question.id}`);
		}
		ids.add(question.id);
	}

	return input.questions.map((question) => ({
		...question,
		allowOther: question.allowOther !== false,
		initialOptionIndex: Math.max(0, question.options.findIndex((option) => option.recommended === true)),
	}));
}
