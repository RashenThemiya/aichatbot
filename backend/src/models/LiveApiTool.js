const mongoose = require("mongoose");

const liveApiParameterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    in: {
      type: String,
      enum: ["path", "query", "body"],
      required: true,
    },
    required: { type: Boolean, default: false },
    description: { type: String, default: "" },
  },
  { _id: false },
);

const liveApiToolSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    sourceDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      default: null,
      index: true,
    },
    generatedFromDocument: {
      type: Boolean,
      default: false,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    method: {
      type: String,
      enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      default: "GET",
    },
    baseUrl: { type: String, required: true, trim: true },
    pathTemplate: { type: String, required: true, trim: true },
    parameters: { type: [liveApiParameterSchema], default: [] },
    staticQuery: { type: mongoose.Schema.Types.Mixed, default: {} },
    staticBody: { type: mongoose.Schema.Types.Mixed, default: {} },
    staticHeaders: { type: mongoose.Schema.Types.Mixed, default: {} },
    authType: {
      type: String,
      enum: ["none", "bearer", "api-key"],
      default: "none",
    },
    authHeaderName: { type: String, default: "Authorization" },
    authValuePrefix: { type: String, default: "Bearer " },
    encryptedAuthSecret: { type: String, default: "" },
    keywordHints: { type: [String], default: [] },
    isEnabled: { type: Boolean, default: true },
    timeoutMs: { type: Number, default: 10000 },
  },
  { timestamps: true },
);

liveApiToolSchema.index({ companyId: 1, isEnabled: 1 });
liveApiToolSchema.index({ companyId: 1, sourceDocumentId: 1 });

module.exports = mongoose.model("LiveApiTool", liveApiToolSchema);
