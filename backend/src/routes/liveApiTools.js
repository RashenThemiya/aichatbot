const express = require("express");

const LiveApiTool = require("../models/LiveApiTool");
const LiveApiCallLog = require("../models/LiveApiCallLog");
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
    // OAuth2 refresh — never expose encrypted values, only metadata
    hasRefreshToken:  Boolean(tool.encryptedRefreshToken),
    tokenClientId:    tool.tokenClientId   || "",
    tokenRefreshUrl:  tool.tokenRefreshUrl || "",
    tokenExpiresAt:   tool.tokenExpiresAt  || null,
    userTokenMode: tool.userTokenMode,
    userTokenHeader: tool.userTokenHeader,
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
      refreshToken,
      clientId,
      clientSecret,
      tokenRefreshUrl,
      tokenExpiresIn,
      userTokenMode,
      userTokenHeader,
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
      encryptedAuthSecret:        authSecret    ? encryptSecret(authSecret)    : "",
      encryptedRefreshToken:      refreshToken  ? encryptSecret(refreshToken)  : "",
      tokenClientId:              clientId      ? String(clientId)             : "",
      encryptedTokenClientSecret: clientSecret  ? encryptSecret(clientSecret)  : "",
      tokenRefreshUrl:            tokenRefreshUrl ? String(tokenRefreshUrl)    : "",
      tokenExpiresAt:             tokenExpiresIn
        ? new Date(Date.now() + Number(tokenExpiresIn) * 1000)
        : null,
      userTokenMode: userTokenMode || "none",
      userTokenHeader: userTokenHeader || "x-user-token",
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
      "userTokenMode",
      "userTokenHeader",
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
    if (req.body.refreshToken !== undefined) {
      tool.encryptedRefreshToken = req.body.refreshToken
        ? encryptSecret(req.body.refreshToken)
        : "";
    }
    if (req.body.clientId !== undefined) {
      tool.tokenClientId = req.body.clientId ? String(req.body.clientId) : "";
    }
    if (req.body.clientSecret !== undefined) {
      tool.encryptedTokenClientSecret = req.body.clientSecret
        ? encryptSecret(req.body.clientSecret)
        : "";
    }
    if (req.body.tokenRefreshUrl !== undefined) {
      tool.tokenRefreshUrl = req.body.tokenRefreshUrl
        ? String(req.body.tokenRefreshUrl)
        : "";
    }
    if (req.body.tokenExpiresIn !== undefined) {
      tool.tokenExpiresAt = req.body.tokenExpiresIn
        ? new Date(Date.now() + Number(req.body.tokenExpiresIn) * 1000)
        : null;
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

router.get("/logs", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const skip = Number(req.query.skip) || 0;
    const filter = { companyId: req.params.companyId };
    if (req.query.sessionId) filter.sessionId = req.query.sessionId;
    if (req.query.toolId) filter.toolId = req.query.toolId;

    const logs = await LiveApiCallLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
