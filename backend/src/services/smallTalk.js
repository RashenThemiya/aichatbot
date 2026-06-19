const GREETING =
  /^(hi+!?|hey+!?|hello+!?|howdy|good\s+(morning|evening|afternoon)|greetings|how\s+are\s+you)\s*$/i;
const THANKS = /^(thanks?|thank\s+you|thx|ty)\s*$/i;
const GOODBYE = /^(bye+!?|goodbye|see\s+you|see\s+ya|cya)\s*$/i;

function normalizeForMatch(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[!?.]+$/g, "");
}

function getSmallTalkReply(message) {
  const text = normalizeForMatch(message);
  if (!text) return null;

  if (GREETING.test(text)) {
    if (/^how\s+are\s+you/i.test(text)) {
      return "I'm doing well, thank you! How can I help you today?";
    }
    return "Hello! How can I help you today? Ask me anything from our support documents.";
  }

  if (THANKS.test(text)) {
    return "You're welcome! Let me know if you need anything else.";
  }

  if (GOODBYE.test(text)) {
    return "Goodbye! Feel free to message again if you need help.";
  }

  return null;
}

module.exports = { getSmallTalkReply };
