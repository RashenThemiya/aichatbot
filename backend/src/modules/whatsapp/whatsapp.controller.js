const config = require("../../config");
const { mapIncomingWebhook } = require("./whatsapp.mapper");
const whatsappService = require("./whatsapp.service");

function verifyWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (!config.whatsappVerifyToken) {
    console.error("WhatsApp webhook verification failed: missing verify token config");
    return res.status(500).json({ error: "Webhook verification is not configured" });
  }

  if (mode === "subscribe" && token === config.whatsappVerifyToken) {
    console.log("WhatsApp webhook verified");
    return res.status(200).send(challenge);
  }

  console.warn("WhatsApp webhook verification failed: invalid mode or token");
  return res.sendStatus(403);
}

async function receiveWebhook(req, res) {
  const messages = mapIncomingWebhook(req.body);

  if (!messages.length) {
    console.log("WhatsApp webhook received without user messages");
    return res.sendStatus(200);
  }

  const results = [];

  for (const message of messages) {
    console.log("WhatsApp message received", {
      whatsappMessageId: message.whatsappMessageId,
      messageType: message.messageType,
      waId: message.waId,
      phoneNumberId: message.phoneNumberId,
    });

    try {
      const result = await whatsappService.replyToIncomingMessage(message);
      results.push({
        whatsappMessageId: message.whatsappMessageId,
        status: "sent",
        result,
      });
    } catch (err) {
      const metaError = err.response?.data?.error;
      const detail = metaError?.message || err.message;

      console.error("WhatsApp webhook message processing failed:", {
        whatsappMessageId: message.whatsappMessageId,
        phoneNumberId: message.phoneNumberId,
        companyId: err.whatsappContext?.companyId,
        accessTokenLast4: err.whatsappContext?.accessTokenLast4,
        status: err.response?.status || 500,
        message: detail,
        type: metaError?.type,
        code: metaError?.code,
        errorSubcode: metaError?.error_subcode,
        fbtraceId: metaError?.fbtrace_id,
      });

      results.push({
        whatsappMessageId: message.whatsappMessageId,
        status: "failed",
        error: {
          message: detail,
          companyId: err.whatsappContext?.companyId,
          phoneNumberId: err.whatsappContext?.phoneNumberId,
          accessTokenLast4: err.whatsappContext?.accessTokenLast4,
          type: metaError?.type,
          code: metaError?.code,
          errorSubcode: metaError?.error_subcode,
          fbtraceId: metaError?.fbtrace_id,
        },
      });
    }
  }

  return res.status(200).json({
    status: "received",
    processed: results.length,
    results,
  });
}

async function sendTextMessage(req, res) {
  try {
    const { to, text, companyId } = req.body;
    const result = await whatsappService.sendTextMessage({ to, text, companyId });

    return res.status(200).json({
      status: "sent",
      result,
    });
  } catch (err) {
    const status = err.response?.status || 500;
    const metaError = err.response?.data?.error;
    const detail = metaError?.message || err.message;

    console.error("WhatsApp manual send failed:", {
      companyId: err.whatsappContext?.companyId,
      phoneNumberId: err.whatsappContext?.phoneNumberId,
      accessTokenLast4: err.whatsappContext?.accessTokenLast4,
      status,
      message: detail,
      type: metaError?.type,
      code: metaError?.code,
      errorSubcode: metaError?.error_subcode,
      fbtraceId: metaError?.fbtrace_id,
    });

    return res.status(status).json({
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
}

module.exports = {
  receiveWebhook,
  sendTextMessage,
  verifyWebhook,
};