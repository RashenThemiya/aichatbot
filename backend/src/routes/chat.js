const express = require("express");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

const Company = require("../models/Company");
const Conversation = require("../models/Conversation");
const ragClient = require("../services/ragClient");
const { preprocessUserMessage } = require("../services/messagePreprocessor");
const { canAccessCompany } = require("../middleware/auth");

const router = express.Router({ mergeParams: true });

router.use((req, res, next) => {
  if (req.baseUrl?.startsWith("/widget/") && !(req.method === "POST" && req.path === "/")) {
    return res.status(404).json({ error: "Not found" });
  }
  next();
});

router.use(canAccessCompany);

function hashApiKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

async function validateWidgetApiKey(req, company) {
  if (!req.baseUrl?.startsWith("/widget/")) return true;
  const apiKey = req.headers["x-widget-api-key"] || req.body.widgetApiKey;
  if (!apiKey) return false;

  const companyWithKey = await Company.findById(company._id).select("+widgetApiKeyHash");
  if (!companyWithKey?.widgetApiKeyHash) return false;
  return crypto.timingSafeEqual(
    Buffer.from(companyWithKey.widgetApiKeyHash),
    Buffer.from(hashApiKey(apiKey))
  );
}

router.post("/", async (req, res) => {
  try {
    const company = await Company.findById(req.params.companyId);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    if (!company.isActive) {
      return res.status(403).json({ error: "Company is inactive" });
    }
    const widgetKeyOk = await validateWidgetApiKey(req, company);
    if (!widgetKeyOk) {
      return res.status(401).json({ error: "Invalid widget API key" });
    }

    const { message, sessionId, customerName, customerEmail, customerPhone } =
      req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    const sid = sessionId || uuidv4();

    let conversation = await Conversation.findOne({
      companyId: company._id,
      sessionId: sid,
    });

    if (!conversation) {
      conversation = new Conversation({
        companyId: company._id,
        sessionId: sid,
        customerName: customerName || "",
        customerEmail: customerEmail || "",
        customerPhone: customerPhone || "",
        channel: "web",
        messages: [],
      });
    } else {
      if (customerName) conversation.customerName = customerName;
      if (customerEmail) conversation.customerEmail = customerEmail;
      if (customerPhone) conversation.customerPhone = customerPhone;
    }

    const originalMessage = message.trim();
    conversation.messages.push({ role: "user", content: originalMessage });

    const preprocessed = await preprocessUserMessage(originalMessage);

    if (preprocessed.type === "small_talk") {
      conversation.messages.push({
        role: "assistant",
        content: preprocessed.reply,
      });
      await conversation.save();

      return res.json({
        sessionId: sid,
        answer: preprocessed.reply,
        sources: [],
        conversationId: conversation._id,
      });
    }

    const ragResult = await ragClient.queryKnowledge({
      companyId: company._id.toString(),
      question: preprocessed.question,
    });

    const sources = (ragResult.sources || []).map((s) => ({
      documentId: s.document_id,
      documentName: s.document_name,
      content: s.content,
      score: s.score,
    }));

    conversation.messages.push({
      role: "assistant",
      content: ragResult.answer,
      sources,
    });

    await conversation.save();

    res.json({
      sessionId: sid,
      answer: ragResult.answer,
      sources,
      conversationId: conversation._id,
    });
  } catch (err) {
    const detail = err.response?.data?.detail || err.message;
    res.status(err.response?.status || 500).json({ error: detail });
  }
});

router.get("/history/:sessionId", async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      companyId: req.params.companyId,
      sessionId: req.params.sessionId,
    });
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/conversations", async (req, res) => {
  try {
    const conversations = await Conversation.find({
      companyId: req.params.companyId,
    })
      .sort({ updatedAt: -1 })
      .select("-messages");
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
