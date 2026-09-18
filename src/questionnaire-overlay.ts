import type { Theme } from "@earendil-works/pi-coding-agent";
import {
	CURSOR_MARKER,
	matchesKey,
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
	type Component,
	type Focusable,
} from "@earendil-works/pi-tui";
import {
	createQuestionnaireState,
	transitionQuestionnaire,
	type QuestionnaireAction,
	type QuestionnaireState,
} from "./questionnaire.js";
import type { Answer, NormalizedQuestion } from "./questions.js";

export type QuestionnaireTheme = Pick<Theme, "fg" | "bg" | "bold">;

export interface QuestionnaireOverlayResult {
	readonly answers: readonly Answer[];
	readonly cancelled: boolean;
}

export class QuestionnaireOverlay implements Component, Focusable {
	focused = false;

	private state: QuestionnaireState;
	private finished = false;

	constructor(
		questions: readonly NormalizedQuestion[],
		private readonly theme: QuestionnaireTheme,
		private readonly onDone: (result: QuestionnaireOverlayResult) => void,
		private readonly onChange: () => void = () => {},
	) {
		this.state = createQuestionnaireState(questions);
	}

	getState(): QuestionnaireState {
		return this.state;
	}

	handleInput(data: string): void {
		const action = actionForInput(data, this.state.mode);
		if (!action) return;

		const nextState = transitionQuestionnaire(this.state, action);
		if (nextState === this.state) return;
		this.state = nextState;
		this.onChange();

		if (!this.finished && nextState.status !== "active") {
			this.finished = true;
			this.onDone({
				answers: nextState.status === "complete" ? nextState.answers : [],
				cancelled: nextState.status === "cancelled",
			});
		}
	}

	render(width: number): string[] {
		const renderWidth = Math.max(1, width);
		const innerWidth = Math.max(1, renderWidth - 2);
		const question = this.state.questions[this.state.questionIndex];
		if (!question) return [truncateToWidth("Question unavailable", renderWidth, "", true)];

		const content: string[] = [];
		this.addWrapped(content, this.theme.fg("accent", this.theme.bold("Agent question")), innerWidth);
		this.addWrapped(
			content,
			this.theme.fg("muted", `Question ${this.state.questionIndex + 1} of ${this.state.questions.length}`),
			innerWidth,
		);
		content.push("");
		this.addWrapped(content, this.theme.fg("text", question.prompt), innerWidth);
		content.push("");

		const options = question.options.map((option) => ({
			label: option.label,
			recommended: option.recommended === true,
		}));
		if (question.allowOther) options.push({ label: "Other...", recommended: false });

		for (let i = 0; i < options.length; i++) {
			const option = options[i]!;
			const selected = i === this.state.selectedOptionIndex;
			const prefix = selected ? "> " : "  ";
			const recommendation = option.recommended ? " (recommended)" : "";
			const label = `${i + 1}. ${option.label}${recommendation}`;
			this.addWrapped(
				content,
				`${prefix}${selected ? this.theme.fg("accent", label) : this.theme.fg("text", label)}`,
				innerWidth,
			);
			const description = question.options[i]?.description;
			if (description) this.addWrapped(content, `     ${this.theme.fg("muted", description)}`, innerWidth);
		}

		if (this.state.mode !== "choices") {
			content.push("");
			const fieldName = this.state.mode === "note" ? "Note" : "Your answer";
			this.addWrapped(content, this.theme.fg("muted", `${fieldName}:`), innerWidth);
			this.addWrapped(content, this.renderInput(innerWidth - 1), innerWidth, " ");
		}

		content.push("");
		const help = this.state.mode === "choices"
			? "↑↓ choose • Enter select • Tab add note • ← back • Esc cancel"
			: this.state.mode === "note"
				? "Type note • Enter save • Esc back"
				: "Type answer • Enter submit • Esc back";
		this.addWrapped(content, this.theme.fg("dim", help), innerWidth);

		if (renderWidth < 3) return content.map((line) => truncateToWidth(line, renderWidth, "", true));
		const border = this.theme.fg("border", "│");
		return [
			this.theme.fg("border", `╭${"─".repeat(innerWidth)}╮`),
			...content.map((line) => `${border}${truncateToWidth(line, innerWidth, "", true)}${border}`),
			this.theme.fg("border", `╰${"─".repeat(innerWidth)}╯`),
		];
	}

	invalidate(): void {}

	private addWrapped(lines: string[], text: string, width: number, prefix = " "): void {
		const prefixWidth = visibleWidth(prefix);
		const textWidth = Math.max(1, width - prefixWidth);
		const wrapped = wrapTextWithAnsi(text, textWidth);
		for (let i = 0; i < wrapped.length; i++) {
			lines.push(`${i === 0 ? prefix : " ".repeat(prefixWidth)}${wrapped[i]}`);
		}
	}

	private renderInput(width: number): string {
		const before = this.state.inputText.slice(0, this.state.inputCursor);
		const atCursor = this.state.inputText[this.state.inputCursor] ?? " ";
		const after = this.state.inputText.slice(this.state.inputCursor + 1);
		const marker = this.focused ? CURSOR_MARKER : "";
		return truncateToWidth(`${before}${marker}\x1b[7m${atCursor}\x1b[27m${after}`, Math.max(1, width), "", true);
	}
}

function actionForInput(data: string, mode: QuestionnaireState["mode"]): QuestionnaireAction | undefined {
	if (matchesKey(data, "up")) return { type: "up" };
	if (matchesKey(data, "down")) return { type: "down" };
	if (matchesKey(data, "left")) return { type: "left" };
	if (matchesKey(data, "right")) return { type: "right" };
	if (matchesKey(data, "tab")) return { type: "tab" };
	if (matchesKey(data, "return")) return { type: "enter" };
	if (matchesKey(data, "escape")) return { type: "escape" };
	if (matchesKey(data, "backspace")) return { type: "backspace" };
	if (mode !== "choices" && data.length > 0 && [...data].every((character) => character.charCodeAt(0) >= 32)) {
		return { type: "text", text: data };
	}
	return undefined;
}
