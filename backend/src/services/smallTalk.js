const GREETING =
  /^(hi+!?|hey+!?|hello+!?|howdy|good\s+(morning|evening|afternoon)|greetings|how\s+are\s+you)\s*$/i;
const THANKS = /^(thanks?|thank\s+you|thx|ty)\s*$/i;
const GOODBYE = /^(bye+!?|goodbye|see\s+you|see\s+ya|cya)\s*$/i;
const INTRODUCTION_PATTERNS = [
  /^(?:(?:(?:hi+|hey+|hello+|good\s+(?:morning|afternoon|evening))[,\s]+)+)?(?:(?:i\s*am|i['’]?m|iam|this\s+is)\s+|my\s+name(?:\s+is)?\s+)([a-z][a-z .'-]{0,49})$/i,
  /^([a-z][a-z .'-]{0,49}?)\s+is\s+my\s+name$/i,
  /^([a-z][a-z .'-]{0,49}?)\s+my\s+name$/i,
  /^(?:call\s+me|you\s+can\s+call\s+me)\s+([a-z][a-z .'-]{0,49})$/i,
];
const NON_NAME_WORDS = new Set([
  "having", "looking", "trying", "using", "unable", "facing",
  "experiencing", "interested", "searching", "asking", "getting",
]);

function normalizeForMatch(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[!?.]+$/g, "")
    .replace(/\bgud\b|\bgd\b/g, "good")
    .replace(/\bmorn(?:in|ing)?\b|\bmoring\b|\bmrning\b/g, "morning")
    .replace(/\baft(?:ernoon)?\b/g, "afternoon")
    .replace(/\bevning\b|\bevenin\b/g, "evening")
    .replace(/\bhelo+\b|\bhllo\b/g, "hello")
    .replace(/\bhw\s+r\s+u\b|\bhow\s+r\s+u\b/g, "how are you")
    .replace(/\bthanx\b|\bthnks\b|\btnx\b/g, "thanks")
    .replace(/\bgudbye\b/g, "goodbye");
}

function getSmallTalkReply(message) {
  const text = normalizeForMatch(message);
  if (!text) return null;

  const introduction = INTRODUCTION_PATTERNS
    .map((pattern) => text.match(pattern))
    .find(Boolean);
  if (introduction) {
    const name = introduction[1].trim().replace(/\s+/g, " ");
    const firstWord = name.split(" ")[0].toLowerCase();
    if (!NON_NAME_WORDS.has(firstWord) && name.split(" ").length <= 4) {
      const displayName = name.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
      return `Nice to meet you, ${displayName}! How can I help you today?`;
    }
  }

  if (GREETING.test(text)) {
    if (/^how\s+are\s+you/i.test(text)) {
      return "I'm doing well, thanks for asking! What can I help you with today?";
    }
    return "Hi there! What can I help you with today?";
  }

  if (THANKS.test(text)) {
    return "You're very welcome! Is there anything else you'd like help with?";
  }

  if (GOODBYE.test(text)) {
    return "Take care! I'm here whenever you need help.";
  }

  return null;
}

module.exports = { getSmallTalkReply };
