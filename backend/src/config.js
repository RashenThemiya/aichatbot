require("dotenv").config();

module.exports = {
  port: process.env.PORT || 3000,
  mongodbUri:
    process.env.MONGODB_URI || "mongodb://localhost:27017/rag_chatbot",
  ragServiceUrl: process.env.RAG_SERVICE_URL || "http://localhost:8000",
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  jwtSecret: process.env.JWT_SECRET || "change-this-dev-secret",
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL || "admin@example.com",
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || "admin123",
  liveApiSecretKey: process.env.LIVE_API_SECRET_KEY || "",
  liveApiTimeoutMs: Number(process.env.LIVE_API_TIMEOUT_MS || 10000),
  liveApiMinPlanConfidence: Number(
    process.env.LIVE_API_MIN_PLAN_CONFIDENCE || 0.55,
  ),
};
