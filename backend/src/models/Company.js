const mongoose = require("mongoose");

const widgetThemeSchema = new mongoose.Schema(
  {
    headerColor: {
      type: String,
      default: "#000000",
    },
    sendButtonColor: {
      type: String,
      default: "#000000",
    },
    launcherColor: {
      type: String,
      default: "#000000",
    },
    launcherIcon: {
      type: String,
      enum: ["bot", "message", "question"],
      default: "bot",
    },
  },
  { _id: false }
);

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    widgetApiKeyHash: {
      type: String,
      default: "",
      select: false,
    },
    widgetApiKeyPreview: {
      type: String,
      default: "",
    },
    widgetTheme: {
      type: widgetThemeSchema,
      default: () => ({
        headerColor: "#000000",
        sendButtonColor: "#000000",
        launcherColor: "#000000",
        launcherIcon: "bot",
      }),
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Company || mongoose.model("Company", companySchema);
