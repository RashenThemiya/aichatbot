require("dotenv").config();

module.exports = {
  port: process.env.PORT || 3000,
  mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017/rag_chatbot",
  ragServiceUrl: process.env.RAG_SERVICE_URL || "http://localhost:8000",
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  jwtSecret: process.env.JWT_SECRET || "change-this-dev-secret",
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL || "admin@example.com",
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || "admin123",
};
