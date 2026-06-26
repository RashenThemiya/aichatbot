const mongoose = require("mongoose");

const liveApiCallLogSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    sessionId: { type: String, default: "", index: true },
    toolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LiveApiTool",
      index: true,
    },
    toolName: { type: String, default: "" },
    method: { type: String, default: "" },
    url: { type: String, default: "" },
    statusCode: { type: Number, default: null },
    ok: { type: Boolean, default: false },
    durationMs: { type: Number, default: 0 },
    userIdentifier: { type: String, default: "" },
    hasUserToken: { type: Boolean, default: false },
    error: { type: String, default: "" },
  },
  { timestamps: true },
);

liveApiCallLogSchema.index({ companyId: 1, createdAt: -1 });
liveApiCallLogSchema.index({ companyId: 1, sessionId: 1 });

module.exports = mongoose.model("LiveApiCallLog", liveApiCallLogSchema);
