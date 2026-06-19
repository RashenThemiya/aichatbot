const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    sources: {
      type: [
        {
          documentId: String,
          documentName: String,
          content: String,
          score: Number,
        },
      ],
      default: [],
    },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    customerName: { type: String, default: "" },
    customerEmail: { type: String, default: "" },
    customerPhone: { type: String, default: "" },
    channel: {
      type: String,
      enum: ["web", "sms", "voice", "whatsapp"],
      default: "web",
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
  },
  { timestamps: true }
);

conversationSchema.index({ companyId: 1, sessionId: 1 }, { unique: true });

module.exports = mongoose.model("Conversation", conversationSchema);
