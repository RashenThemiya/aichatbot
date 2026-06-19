const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      default: "application/pdf",
    },
    docType: {
      type: String,
      enum: ["pdf", "api"],
      default: "pdf",
      index: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "indexing", "indexed", "failed"],
      default: "pending",
    },
    chunksIndexed: {
      type: Number,
      default: 0,
    },
    indexError: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Document", documentSchema);
