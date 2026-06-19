const express = require("express");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

const Company = require("../models/Company");
const Conversation = require("../models/Conversation");
const LiveApiTool = require("../models/LiveApiTool");
const ragClient = require("../services/ragClient");
const config = require("../config");
const {
  executePlannedTool,
  sanitizeToolsForPlanner,
} = require("../services/liveApiTools");
const { canAccessCompany } = require("../middleware/auth");

const router = express.Router({ mergeParams: true });

router.use((req, res, next) => {
  if (
    req.baseUrl?.startsWith("/widget/") &&
    !(req.method === "POST" && req.path === "/")
  ) {
    return res.status(404).json({ error: "Not found" });
  }
  next();
});

router.use(canAccessCompany);

function hashApiKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function asText(value, maxLen = 3500) {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
}

function buildLiveContext(liveResult) {
  if (!liveResult) return "";
  const responseBody = liveResult.ok
    ? asText(liveResult.response)
    : `Live API call failed (${liveResult.status || "error"}): ${liveResult.error || "Unknown error"}`;

  return [
    "Live API Result:",
    `Tool: ${liveResult.toolName}`,
    `Request: ${liveResult.method} ${liveResult.url}`,
    `Status: ${liveResult.status ?? "unknown"}`,
    `Body: ${responseBody}`,
  ].join("\n");
}

function liveSourceFromResult(liveResult) {
  if (!liveResult) return [];
  return [
    {
      documentId: `live_api:${liveResult.toolId}`,
      documentName: `Live API - ${liveResult.toolName}`,
      content: asText(liveResult.response, 280),
      score: liveResult.ok ? 1 : 0,
    },
  ];
}

async function validateWidgetApiKey(req, company) {
  if (!req.baseUrl?.startsWith("/widget/")) return true;
  const apiKey = req.headers["x-widget-api-key"] || req.body.widgetApiKey;
  if (!apiKey) return false;

  const companyWithKey = await Company.findById(company._id).select(
    "+widgetApiKeyHash",
  );
  if (!companyWithKey?.widgetApiKeyHash) return false;
  return crypto.timingSafeEqual(
    Buffer.from(companyWithKey.widgetApiKeyHash),
    Buffer.from(hashApiKey(apiKey)),
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

    conversation.messages.push({ role: "user", content: message.trim() });

    let liveResult = null;
    const liveTools = await LiveApiTool.find({
      companyId: company._id,
      isEnabled: true,
    });

    if (liveTools.length) {
      try {
        const toolPlan = await ragClient.planLiveTool({
          question: message.trim(),
          tools: sanitizeToolsForPlanner(liveTools),
        });

        if (
          toolPlan?.use_live_tool &&
          toolPlan.tool_id &&
          Number(toolPlan.confidence || 0) >= config.liveApiMinPlanConfidence
        ) {
          const selectedTool = liveTools.find(
            (item) => item._id.toString() === toolPlan.tool_id,
          );
          if (selectedTool) {
            try {
              liveResult = await executePlannedTool(selectedTool, toolPlan);
            } catch (execErr) {
              liveResult = {
                toolId: selectedTool._id.toString(),
                toolName: selectedTool.name,
                method: selectedTool.method,
                url: `${selectedTool.baseUrl}${selectedTool.pathTemplate}`,
                status: null,
                ok: false,
                error: execErr.message,
                response: null,
              };
            }
          }
        }
      } catch {
        liveResult = null;
      }
    }

    const ragResult = await ragClient.queryKnowledgeWithContext({
      companyId: company._id.toString(),
      question: message.trim(),
      extraContext: buildLiveContext(liveResult),
    });

    const sources = (ragResult.sources || []).map((s) => ({
      documentId: s.document_id,
      documentName: s.document_name,
      content: s.content,
      score: s.score,
    }));
    const finalSources = [...sources, ...liveSourceFromResult(liveResult)];

    conversation.messages.push({
      role: "assistant",
      content: ragResult.answer,
      sources: finalSources,
    });

    await conversation.save();

    res.json({
      sessionId: sid,
      answer: ragResult.answer,
      sources: finalSources,
      conversationId: conversation._id,
      liveApi: liveResult
        ? {
            toolName: liveResult.toolName,
            status: liveResult.status,
            ok: liveResult.ok,
          }
        : null,
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
