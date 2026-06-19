const express = require("express");

const LiveApiTool = require("../models/LiveApiTool");
const { canAccessCompany } = require("../middleware/auth");
const { encryptSecret } = require("../services/crypto");

const router = express.Router({ mergeParams: true });

router.use(canAccessCompany);

function toSafeTool(tool) {
  return {
    _id: tool._id,
    companyId: tool.companyId,
    sourceDocumentId: tool.sourceDocumentId,
    generatedFromDocument: tool.generatedFromDocument,
    name: tool.name,
    description: tool.description,
    method: tool.method,
    baseUrl: tool.baseUrl,
    pathTemplate: tool.pathTemplate,
    parameters: tool.parameters,
    staticQuery: tool.staticQuery,
    staticBody: tool.staticBody,
    staticHeaders: tool.staticHeaders,
    authType: tool.authType,
    authHeaderName: tool.authHeaderName,
    authValuePrefix: tool.authValuePrefix,
    hasAuthSecret: Boolean(tool.encryptedAuthSecret),
    keywordHints: tool.keywordHints,
    isEnabled: tool.isEnabled,
    timeoutMs: tool.timeoutMs,
    createdAt: tool.createdAt,
    updatedAt: tool.updatedAt,
  };
}

router.get("/", async (req, res) => {
  try {
    const items = await LiveApiTool.find({
      companyId: req.params.companyId,
    }).sort({
      createdAt: -1,
    });
    res.json(items.map(toSafeTool));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      name,
      description,
      method,
      baseUrl,
      pathTemplate,
      parameters,
      staticQuery,
      staticBody,
      staticHeaders,
      authType,
      authHeaderName,
      authValuePrefix,
      authSecret,
      keywordHints,
      isEnabled,
      timeoutMs,
    } = req.body;

    if (!name || !baseUrl || !pathTemplate) {
      return res.status(400).json({
        error: "name, baseUrl and pathTemplate are required",
      });
    }

    const tool = await LiveApiTool.create({
      companyId: req.params.companyId,
      name,
      description: description || "",
      method: (method || "GET").toUpperCase(),
      baseUrl,
      pathTemplate,
      parameters: Array.isArray(parameters) ? parameters : [],
      staticQuery: staticQuery || {},
      staticBody: staticBody || {},
      staticHeaders: staticHeaders || {},
      authType: authType || "none",
      authHeaderName: authHeaderName || "Authorization",
      authValuePrefix: authValuePrefix || "Bearer ",
      encryptedAuthSecret: authSecret ? encryptSecret(authSecret) : "",
      keywordHints: Array.isArray(keywordHints) ? keywordHints : [],
      isEnabled: isEnabled !== false,
      timeoutMs: Number(timeoutMs || 10000),
    });

    res.status(201).json(toSafeTool(tool));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:toolId", async (req, res) => {
  try {
    const tool = await LiveApiTool.findOne({
      _id: req.params.toolId,
      companyId: req.params.companyId,
    });

    if (!tool) {
      return res.status(404).json({ error: "Tool not found" });
    }

    const fields = [
      "name",
      "description",
      "method",
      "baseUrl",
      "pathTemplate",
      "parameters",
      "staticQuery",
      "staticBody",
      "staticHeaders",
      "authType",
      "authHeaderName",
      "authValuePrefix",
      "keywordHints",
      "isEnabled",
      "timeoutMs",
    ];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        tool[field] =
          field === "method"
            ? String(req.body[field]).toUpperCase()
            : req.body[field];
      }
    }

    if (req.body.authSecret !== undefined) {
      tool.encryptedAuthSecret = req.body.authSecret
        ? encryptSecret(req.body.authSecret)
        : "";
    }

    await tool.save();
    res.json(toSafeTool(tool));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:toolId", async (req, res) => {
  try {
    const deleted = await LiveApiTool.findOneAndDelete({
      _id: req.params.toolId,
      companyId: req.params.companyId,
    });

    if (!deleted) {
      return res.status(404).json({ error: "Tool not found" });
    }

    res.json({ message: "Tool deleted", toolId: req.params.toolId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
