const express = require("express");

const Company = require("../models/Company");
const WhatsAppIntegration = require("../models/WhatsAppIntegration");
const whatsappService = require("../modules/whatsapp/whatsapp.service");

const router = express.Router({ mergeParams: true });

async function ensureCompany(companyId) {
  const company = await Company.findById(companyId);
  if (!company) {
    const err = new Error("Company not found");
    err.status = 404;
    throw err;
  }
  return company;
}

async function findIntegration(companyId, includeSecret = false) {
  const query = WhatsAppIntegration.findOne({ companyId });
  if (includeSecret) {
    query.select("+encryptedAccessToken +accessTokenIv +accessTokenAuthTag");
  }
  return query;
}

function getWhatsAppPayload(body) {
  return {
    accessToken: body.accessToken || body.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: body.phoneNumberId || body.WHATSAPP_PHONE_NUMBER_ID,
    isActive: body.isActive,
  };
}

router.post("/", async (req, res) => {
  try {
    await ensureCompany(req.params.companyId);

    const { accessToken, phoneNumberId, isActive } = getWhatsAppPayload(req.body);
    if (!accessToken || !String(accessToken).trim()) {
      return res.status(400).json({ error: "WhatsApp access token is required" });
    }
    if (!phoneNumberId || !String(phoneNumberId).trim()) {
      return res.status(400).json({ error: "WhatsApp phone number ID is required" });
    }

    const existingPhoneOwner = await WhatsAppIntegration.findOne({
      phoneNumberId: String(phoneNumberId).trim(),
      companyId: { $ne: req.params.companyId },
    });
    if (existingPhoneOwner) {
      return res
        .status(409)
        .json({ error: "WhatsApp phone number ID is already configured" });
    }

    let integration = await findIntegration(req.params.companyId, true);
    const statusCode = integration ? 200 : 201;

    if (!integration) {
      integration = new WhatsAppIntegration({ companyId: req.params.companyId });
    }

    integration.phoneNumberId = String(phoneNumberId).trim();
    integration.isActive = typeof isActive === "boolean" ? isActive : integration.isActive;
    integration.setAccessToken(accessToken);
    await integration.save();

    res.status(statusCode).json(integration.toSafeJSON());
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    await ensureCompany(req.params.companyId);

    const integration = await findIntegration(req.params.companyId);
    if (!integration) {
      return res.status(404).json({ error: "WhatsApp integration not found" });
    }

    res.json(integration.toSafeJSON());
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post("/validate", async (req, res) => {
  try {
    await ensureCompany(req.params.companyId);

    const result = await whatsappService.validateIntegration({
      companyId: req.params.companyId,
    });

    res.json(result);
  } catch (err) {
    const status = err.response?.status || err.status || 500;
    const metaError = err.response?.data?.error;
    const detail = metaError?.message || err.message;

    res.status(status).json({
      status: "invalid",
      error: detail,
      companyId: err.whatsappContext?.companyId,
      phoneNumberId: err.whatsappContext?.phoneNumberId,
      accessTokenLast4: err.whatsappContext?.accessTokenLast4,
      type: metaError?.type,
      code: metaError?.code,
      errorSubcode: metaError?.error_subcode,
      fbtraceId: metaError?.fbtrace_id,
    });
  }
});

router.put("/", async (req, res) => {
  try {
    await ensureCompany(req.params.companyId);

    const integration = await findIntegration(req.params.companyId, true);
    if (!integration) {
      return res.status(404).json({ error: "WhatsApp integration not found" });
    }

    const { accessToken, phoneNumberId, isActive } = getWhatsAppPayload(req.body);
    if (
      !accessToken &&
      !phoneNumberId &&
      typeof isActive !== "boolean"
    ) {
      return res.status(400).json({
        error:
          "At least one of accessToken, WHATSAPP_ACCESS_TOKEN, phoneNumberId, WHATSAPP_PHONE_NUMBER_ID, or isActive is required",
      });
    }

    if (phoneNumberId && String(phoneNumberId).trim() !== integration.phoneNumberId) {
      const existingPhoneOwner = await WhatsAppIntegration.findOne({
        phoneNumberId: String(phoneNumberId).trim(),
        companyId: { $ne: req.params.companyId },
      });
      if (existingPhoneOwner) {
        return res
          .status(409)
          .json({ error: "WhatsApp phone number ID is already configured" });
      }
      integration.phoneNumberId = String(phoneNumberId).trim();
    }

    if (typeof isActive === "boolean") {
      integration.isActive = isActive;
    }

    if (accessToken) {
      integration.setAccessToken(accessToken);
    }

    await integration.save();
    res.json(integration.toSafeJSON());
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete("/", async (req, res) => {
  try {
    await ensureCompany(req.params.companyId);

    const integration = await findIntegration(req.params.companyId);
    if (!integration) {
      return res.status(404).json({ error: "WhatsApp integration not found" });
    }

    await integration.deleteOne();
    res.json({ message: "WhatsApp integration deleted" });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;