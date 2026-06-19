const axios = require("axios");

const config = require("../../config");
const Company = require("../../models/Company");
const Conversation = require("../../models/Conversation");
const WhatsAppIntegration = require("../../models/WhatsAppIntegration");
const ragClient = require("../../services/ragClient");
const { preprocessUserMessage } = require("../../services/messagePreprocessor");

function assertGraphConfig() {
  if (!config.graphApiVersion) {
    throw new Error("Missing WhatsApp configuration: GRAPH_API_VERSION");
  }
}

function buildMessagesUrl(phoneNumberId) {
  assertGraphConfig();

  const version = config.graphApiVersion.startsWith("v")
    ? config.graphApiVersion
    : `v${config.graphApiVersion}`;

  return `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
}

function buildPhoneNumberUrl(phoneNumberId) {
  assertGraphConfig();

  const version = config.graphApiVersion.startsWith("v")
    ? config.graphApiVersion
    : `v${config.graphApiVersion}`;

  return `https://graph.facebook.com/${version}/${phoneNumberId}`;
}

function createEchoReply(incomingMessage) {
  if (!incomingMessage.isSupported) {
    return incomingMessage.fallbackText;
  }

  return `You said: ${incomingMessage.textBody || "[empty message]"}`;
}

function mapSources(sources) {
  return (sources || []).map((source) => ({
    documentId: source.document_id,
    documentName: source.document_name,
    content: source.content,
    score: source.score,
  }));
}

async function getCompany(companyId) {
  const company = await Company.findById(companyId);
  if (!company) {
    throw new Error("WhatsApp company not found");
  }

  if (!company.isActive) {
    throw new Error("WhatsApp company is inactive");
  }

  return company;
}

async function getIntegrationByPhoneNumberId(phoneNumberId) {
  if (!phoneNumberId || !String(phoneNumberId).trim()) {
    throw new Error("WhatsApp phone number ID missing from webhook payload");
  }

  const integration = await WhatsAppIntegration.findOne({
    phoneNumberId: String(phoneNumberId).trim(),
    isActive: true,
  }).select("+encryptedAccessToken +accessTokenIv +accessTokenAuthTag");

  if (!integration) {
    throw new Error("WhatsApp integration not found for phone number ID");
  }

  return integration;
}

async function getIntegrationByCompanyId(companyId) {
  if (!companyId || !String(companyId).trim()) {
    throw new Error("Company ID is required for WhatsApp send");
  }

  const integration = await WhatsAppIntegration.findOne({
    companyId,
    isActive: true,
  }).select("+encryptedAccessToken +accessTokenIv +accessTokenAuthTag");

  if (!integration) {
    throw new Error("Active WhatsApp integration not found for company");
  }

  await getCompany(integration.companyId);

  return integration;
}

async function createRagReply(incomingMessage) {
  if (!incomingMessage.isSupported) {
    return {
      answer: incomingMessage.fallbackText,
      sources: [],
      conversationId: null,
      sessionId: null,
    };
  }

  const question = incomingMessage.textBody.trim();
  if (!question) {
    return {
      answer: "Please send a text message so I can help you.",
      sources: [],
      conversationId: null,
      sessionId: null,
    };
  }

  const integration = await getIntegrationByPhoneNumberId(incomingMessage.phoneNumberId);
  const company = await getCompany(integration.companyId);
  const sessionId = `whatsapp:${incomingMessage.waId || incomingMessage.senderPhoneNumber}`;

  let conversation = await Conversation.findOne({
    companyId: company._id,
    sessionId,
  });

  if (!conversation) {
    conversation = new Conversation({
      companyId: company._id,
      sessionId,
      customerName: incomingMessage.customerProfileName || "",
      customerPhone: incomingMessage.senderPhoneNumber || "",
      channel: "whatsapp",
      messages: [],
    });
  } else {
    if (incomingMessage.customerProfileName) {
      conversation.customerName = incomingMessage.customerProfileName;
    }
    if (incomingMessage.senderPhoneNumber) {
      conversation.customerPhone = incomingMessage.senderPhoneNumber;
    }
  }

  conversation.messages.push({ role: "user", content: question });

  const preprocessed = await preprocessUserMessage(question);

  if (preprocessed.type === "small_talk") {
    conversation.messages.push({
      role: "assistant",
      content: preprocessed.reply,
    });
    await conversation.save();

    return {
      answer: preprocessed.reply,
      sources: [],
      conversationId: conversation._id,
      sessionId,
      integration,
    };
  }

  const ragResult = await ragClient.queryKnowledge({
    companyId: company._id.toString(),
    question: preprocessed.question,
  });

  const sources = mapSources(ragResult.sources);
  const answer = ragResult.answer || "I could not find an answer for that yet.";

  conversation.messages.push({
    role: "assistant",
    content: answer,
    sources,
  });

  await conversation.save();

  return {
    answer,
    sources,
    conversationId: conversation._id,
    sessionId,
    integration,
  };
}

async function sendTextMessage({ to, text, companyId, integration }) {
  if (!to || !String(to).trim()) {
    throw new Error("Recipient phone number is required");
  }

  if (!text || !String(text).trim()) {
    throw new Error("Message text is required");
  }

  const activeIntegration = integration || (await getIntegrationByCompanyId(companyId));
  const accessToken = activeIntegration.getAccessToken();

  try {
    const response = await axios.post(
      buildMessagesUrl(activeIntegration.phoneNumberId),
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: String(to).trim(),
        type: "text",
        text: {
          preview_url: false,
          body: String(text).trim(),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (err) {
    err.whatsappContext = {
      companyId: activeIntegration.companyId?.toString(),
      phoneNumberId: activeIntegration.phoneNumberId,
      accessTokenLast4: activeIntegration.accessTokenLast4,
    };
    throw err;
  }
}

async function validateIntegration({ companyId }) {
  const integration = await getIntegrationByCompanyId(companyId);
  const accessToken = integration.getAccessToken();

  let response;
  try {
    response = await axios.get(buildPhoneNumberUrl(integration.phoneNumberId), {
      params: {
        fields: "id,display_phone_number,verified_name,quality_rating",
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (err) {
    err.whatsappContext = {
      companyId: integration.companyId?.toString(),
      phoneNumberId: integration.phoneNumberId,
      accessTokenLast4: integration.accessTokenLast4,
    };
    throw err;
  }

  return {
    status: "valid",
    companyId: integration.companyId,
    phoneNumberId: integration.phoneNumberId,
    accessTokenLast4: integration.accessTokenLast4,
    metaPhoneNumber: response.data,
  };
}

async function replyToIncomingMessage(incomingMessage) {
  const reply = await createRagReply(incomingMessage);
  const integration =
    reply.integration || (await getIntegrationByPhoneNumberId(incomingMessage.phoneNumberId));

  const metaResult = await sendTextMessage({
    to: incomingMessage.senderPhoneNumber,
    text: reply.answer,
    integration,
  });

  return {
    answer: reply.answer,
    sources: reply.sources,
    conversationId: reply.conversationId,
    sessionId: reply.sessionId,
    metaResult,
  };
}

module.exports = {
  createEchoReply,
  createRagReply,
  replyToIncomingMessage,
  sendTextMessage,
  validateIntegration,
};