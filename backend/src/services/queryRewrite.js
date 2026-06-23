const axios = require("axios");
const config = require("../config");

const REWRITE_TIMEOUT_MS = 15000;
const isDev = process.env.NODE_ENV !== "production";

const SMALL_TALK_INTENTS = new Set(["greeting", "thanks", "goodbye"]);

const SYSTEM_PROMPT = `You classify and preprocess customer messages for a support chatbot.

Return JSON only with this exact shape:
{
  "intent": "greeting" | "thanks" | "goodbye" | "support_question",
  "reply": "short friendly reply for greeting/thanks/goodbye, otherwise null",
  "correctedQuestion": "spelling-corrected question for support_question, otherwise null"
}

Rules:
- Use greeting, thanks, or goodbye ONLY when the message is purely social with no support question.
- If the message mixes small talk with a real question (e.g. "hi how do I reset password"), use support_question.
- For support_question, fix spelling and grammar in correctedQuestion while keeping the meaning.
- reply must be one short friendly sentence for greeting, thanks, or goodbye.
- Do not answer support questions in reply; only set correctedQuestion.`;

function logAnalyze(original, result, reason) {
  if (!isDev) return;
  if (reason) {
    console.log(`[queryRewrite] ${reason}: "${original}"`);
  }
}

function parseAnalyzeResponse(content, original) {
  if (!content) {
    return { intent: "support_question", reply: null, correctedQuestion: original };
  }

  try {
    const parsed = JSON.parse(content);
    const intent = SMALL_TALK_INTENTS.has(parsed.intent)
      ? parsed.intent
      : "support_question";

    if (intent !== "support_question") {
      return {
        intent,
        reply: String(parsed.reply || "").trim() || null,
        correctedQuestion: null,
      };
    }

    const correctedQuestion =
      String(parsed.correctedQuestion || "").trim() || original;

    return {
      intent: "support_question",
      reply: null,
      correctedQuestion,
    };
  } catch {
    return { intent: "support_question", reply: null, correctedQuestion: original };
  }
}

async function analyzeUserMessage(message) {
  const original = String(message || "").trim();
  if (!original) {
    return { intent: "support_question", reply: null, correctedQuestion: original };
  }

  if (!config.openaiApiKey) {
    logAnalyze(original, null, "skipped AI analyze (no OPENAI_API_KEY)");
    return { intent: "support_question", reply: null, correctedQuestion: original };
  }

  try {
    const { data } = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: config.openaiChatModel,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: original },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${config.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        timeout: REWRITE_TIMEOUT_MS,
      }
    );

    const content = data?.choices?.[0]?.message?.content?.trim();
    return parseAnalyzeResponse(content, original);
  } catch (err) {
    logAnalyze(
      original,
      null,
      `fallback to original (${err.message || "analyze failed"})`
    );
    return { intent: "support_question", reply: null, correctedQuestion: original };
  }
}

async function rewriteUserQuery(message) {
  const analyzed = await analyzeUserMessage(message);
  return analyzed.correctedQuestion || String(message || "").trim();
}

module.exports = { analyzeUserMessage, rewriteUserQuery };
