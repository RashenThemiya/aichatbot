const axios = require("axios");
const config = require("../config");

const REWRITE_TIMEOUT_MS = 15000;
const isDev = process.env.NODE_ENV !== "production";

function logRewrite(original, corrected, reason) {
  if (!isDev) return;
  if (reason) {
    console.log(`[queryRewrite] ${reason}: "${original}"`);
    return;
  }
  if (corrected === original) {
    console.log(`[queryRewrite] unchanged: "${original}"`);
    return;
  }
  console.log(`[queryRewrite] original:  "${original}"`);
  console.log(`[queryRewrite] corrected: "${corrected}"`);
}

const SYSTEM_PROMPT = `You fix spelling and grammar in customer support questions.
Rules:
- Keep the original meaning and intent.
- Do not add new information or answer the question.
- Return only the corrected question as plain text.
- If the text is already correct, return it unchanged.`;

async function rewriteUserQuery(message) {
  const original = String(message || "").trim();
  if (!original) return original;

  if (!config.openaiApiKey) {
    logRewrite(original, original, "skipped (no OPENAI_API_KEY)");
    return original;
  }

  try {
    const { data } = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: config.openaiChatModel,
        temperature: 0,
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

    const corrected = data?.choices?.[0]?.message?.content?.trim();
    const result = corrected || original;
    logRewrite(original, result);
    return result;
  } catch (err) {
    logRewrite(original, original, `fallback to original (${err.message || "rewrite failed"})`);
    return original;
  }
}

module.exports = { rewriteUserQuery };
