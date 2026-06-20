require("dotenv").config();

function parseCsvEnv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

module.exports = {
  port: process.env.PORT || 3000,
  mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017/rag_chatbot",
  ragServiceUrl: process.env.RAG_SERVICE_URL || "http://localhost:8000",
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  jwtSecret: process.env.JWT_SECRET || "change-this-dev-secret",
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL || "admin@example.com",
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || "admin123",
  graphApiVersion: process.env.GRAPH_API_VERSION || "v20.0",
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
  whatsappTokenEncryptionKey: process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY,
  smsTokenEncryptionKey:
    process.env.SMS_TOKEN_ENCRYPTION_KEY || process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY,
  twilioValidateWebhookSignature:
    process.env.TWILIO_VALIDATE_WEBHOOK_SIGNATURE !== "false",
  publicBackendUrl: process.env.PUBLIC_BACKEND_URL || "",
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiChatModel: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
  googleClientIds: parseCsvEnv(
    process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID
  ),
};
