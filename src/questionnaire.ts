import type { Answer, NormalizedQuestion } from "./questions.js";

export type QuestionnaireMode = "choices" | "note" | "free-text";
export type QuestionnaireStatus = "active" | "complete" | "cancelled";

export interface QuestionnaireState {
	readonly questions: readonly NormalizedQuestion[];
	readonly answers: readonly Answer[];
	readonly questionIndex: number;
	readonly selectedOptionIndex: number;
	readonly mode: QuestionnaireMode;
	readonly inputText: string;
	readonly inputCursor: number;
	readonly status: QuestionnaireStatus;
}

export type QuestionnaireAction =
	| { type: "up" }
	| { type: "down" }
	| { type: "left" }
	| { type: "right" }
	| { type: "tab" }
	| { type: "enter" }
	| { type: "escape" }
	| { type: "backspace" }
	| { type: "text"; text: string };

export function createQuestionnaireState(questions: readonly NormalizedQuestion[]): QuestionnaireState {
	const question = questions[0];
	if (!question) throw new Error("at least one question is required");

	return {
		questions,
		answers: [],
		questionIndex: 0,
		selectedOptionIndex: question.initialOptionIndex,
		mode: "choices",
		inputText: "",
		inputCursor: 0,
		status: "active",
	};
}

function saveAnswer(answers: readonly Answer[], answer: Answer): readonly Answer[] {
	if (answers.some((item) => item.questionId === answer.questionId)) {
		return answers.map((item) => (item.questionId === answer.questionId ? answer : item));
	}
	return [...answers, answer];
}

function answerFor(answers: readonly Answer[], questionId: string): Answer | undefined {
	return answers.find((answer) => answer.questionId === questionId);
}

function advance(state: QuestionnaireState, answers: readonly Answer[]): QuestionnaireState {
	if (state.questionIndex === state.questions.length - 1) {
		return { ...state, answers, status: "complete", mode: "choices", inputText: "", inputCursor: 0 };
	}

	const nextQuestion = state.questions[state.questionIndex + 1]!;
	return {
		...state,
		answers,
		questionIndex: state.questionIndex + 1,
		selectedOptionIndex: nextQuestion.initialOptionIndex,
		mode: "choices",
		inputText: "",
		inputCursor: 0,
	};
}

function restoredOptionIndex(question: NormalizedQuestion, answer: Answer | undefined): number {
	if (!answer) return question.initialOptionIndex;
	if (answer.isOther) return question.options.length;
	const optionIndex = question.options.findIndex((option) => option.value === answer.value);
	return optionIndex >= 0 ? optionIndex : question.initialOptionIndex;
}

export function transitionQuestionnaire(
	state: QuestionnaireState,
	action: QuestionnaireAction,
): QuestionnaireState {
	if (state.status !== "active") return state;

	const question = state.questions[state.questionIndex];
	if (!question) return state;

	if (state.mode !== "choices") {
		if (action.type === "escape") {
			return { ...state, mode: "choices", inputText: "", inputCursor: 0 };
		}
		if (action.type === "text") {
			const inputText = `${state.inputText.slice(0, state.inputCursor)}${action.text}${state.inputText.slice(state.inputCursor)}`;
			return { ...state, inputText, inputCursor: state.inputCursor + action.text.length };
		}
		if (action.type === "backspace" && state.inputCursor > 0) {
			const inputText = state.inputText.slice(0, state.inputCursor - 1) + state.inputText.slice(state.inputCursor);
			return { ...state, inputText, inputCursor: state.inputCursor - 1 };
		}
		if (action.type === "left") {
			return { ...state, inputCursor: Math.max(0, state.inputCursor - 1) };
		}
		if (action.type === "right") {
			return { ...state, inputCursor: Math.min(state.inputText.length, state.inputCursor + 1) };
		}
		if (action.type === "enter") {
			if (state.mode === "free-text") {
				const value = state.inputText.trim();
				if (!value) return state;
				const answer: Answer = {
					questionId: question.id,
					value,
					label: value,
					isOther: true,
				};
				return advance(state, saveAnswer(state.answers, answer));
			}

			const option = question.options[state.selectedOptionIndex];
			if (!option) return state;
			const answer: Answer = {
				questionId: question.id,
				value: option.value,
				label: option.label,
				...(state.inputText.trim() ? { note: state.inputText.trim() } : {}),
				isOther: false,
			};
			return advance(state, saveAnswer(state.answers, answer));
		}
		return state;
	}

	if (action.type === "up" || action.type === "down") {
		const optionCount = question.options.length + (question.allowOther ? 1 : 0);
		const delta = action.type === "up" ? -1 : 1;
		const selectedOptionIndex = Math.min(
			optionCount - 1,
			Math.max(0, state.selectedOptionIndex + delta),
		);
		return { ...state, selectedOptionIndex };
	}

	if (action.type === "left" && state.questionIndex > 0) {
		const previousQuestion = state.questions[state.questionIndex - 1]!;
		const previousAnswer = answerFor(state.answers, previousQuestion.id);
		return {
			...state,
			questionIndex: state.questionIndex - 1,
			selectedOptionIndex: restoredOptionIndex(previousQuestion, previousAnswer),
		};
	}

	if (action.type === "tab" && state.selectedOptionIndex < question.options.length) {
		const previous = answerFor(state.answers, question.id);
		const inputText = previous?.isOther ? "" : previous?.note ?? "";
		return { ...state, mode: "note", inputText, inputCursor: inputText.length };
	}

	if (action.type === "escape") {
		return { ...state, answers: [], status: "cancelled" };
	}

	if (action.type === "enter") {
		if (state.selectedOptionIndex === question.options.length && question.allowOther) {
			const previous = answerFor(state.answers, question.id);
			const inputText = previous?.isOther ? previous.value : "";
			return { ...state, mode: "free-text", inputText, inputCursor: inputText.length };
		}

		const option = question.options[state.selectedOptionIndex];
		if (!option) return state;
		const answer: Answer = {
			questionId: question.id,
			value: option.value,
			label: option.label,
			isOther: false,
		};
		return advance(state, saveAnswer(state.answers, answer));
	}

	return state;
}
