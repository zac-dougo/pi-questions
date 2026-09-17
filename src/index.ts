import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { AskUserInputSchema, normalizeQuestions, type AskUserResult } from "./questions.js";
import { QuestionnaireOverlay } from "./questionnaire-overlay.js";
import { askUserOverRpc } from "./rpc.js";
import { formatAskUserResult } from "./results.js";

export default function piQuestions(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "ask_user",
		label: "Ask User",
		description:
			"Ask the user one or more questions with preset choices, an optional recommended choice, notes, and free-text answers. Use when you need a decision, preference, clarification, or confirmation before continuing.",
		promptSnippet: "Ask the user for structured choices or clarification",
		promptGuidelines: [
			"Use ask_user when a decision or clarification benefits from explicit choices.",
			"Use one ask_user question when a later question depends on an earlier answer.",
		],
		parameters: AskUserInputSchema,
		executionMode: "sequential",

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const questions = normalizeQuestions(params);
			if (ctx.mode === "rpc") {
				const result = await askUserOverRpc(questions, ctx);
				return {
					content: [{ type: "text", text: formatAskUserResult(result) }],
					details: result,
				};
			}
			if (ctx.mode !== "tui") {
				return {
					content: [{ type: "text", text: "ask_user requires an interactive UI" }],
					details: { answers: [], cancelled: true },
				};
			}

			const result = await ctx.ui.custom<AskUserResult>(
				(tui, theme, _keybindings, done) =>
					new QuestionnaireOverlay(questions, theme, done, () => tui.requestRender()),
				{
					overlay: true,
					overlayOptions: { anchor: "center", width: 60, maxHeight: "80%" },
				},
			);
			const resolved: AskUserResult = result ?? { answers: [], cancelled: true };
			return {
				content: [{ type: "text", text: formatAskUserResult(resolved) }],
				details: resolved,
			};
		},

		renderCall(args, theme) {
			const questions = Array.isArray(args.questions) ? args.questions : [];
			return new Text(
				theme.fg("toolTitle", theme.bold("ask_user ")) +
					theme.fg("muted", `${questions.length} question${questions.length === 1 ? "" : "s"}`),
				0,
				0,
			);
		},

		renderResult(result, _options, theme) {
			const details = result.details as AskUserResult | undefined;
			if (!details) return new Text("", 0, 0);
			if (details.cancelled) return new Text(theme.fg("warning", "Cancelled"), 0, 0);

			const lines = details.answers.map((answer) => {
				const note = answer.note ? theme.fg("muted", ` (note: ${answer.note})`) : "";
				return theme.fg("success", "✓ ") + theme.fg("accent", answer.questionId) + `: ${answer.label}${note}`;
			});
			return new Text(lines.join("\n"), 0, 0);
		},
	});
}
