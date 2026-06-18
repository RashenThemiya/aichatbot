const express = require("express");
const crypto = require("crypto");
const Company = require("../models/Company");
const { requireSuperAdmin, canAccessCompany } = require("../middleware/auth");

const router = express.Router();

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hashApiKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function createWidgetApiKey() {
  return `ragw_${crypto.randomBytes(32).toString("hex")}`;
}

router.post("/", requireSuperAdmin, async (req, res) => {
  try {
    const { name, description, slug } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Company name is required" });
    }

    const companySlug = slug || slugify(name);
    const existing = await Company.findOne({ slug: companySlug });
    if (existing) {
      return res.status(409).json({ error: "Company slug already exists" });
    }

    const company = await Company.create({
      name,
      slug: companySlug,
      description: description || "",
    });

    res.status(201).json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", async (_req, res) => {
  try {
    const filter =
      _req.user.role === "superadmin" ? {} : { _id: _req.user.companyId };
    const companies = await Company.find(filter).sort({ createdAt: -1 });
    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", canAccessCompany, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    res.json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", canAccessCompany, async (req, res) => {
  try {
    const { name, description, isActive } = req.body;
    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { name, description, isActive },
      { new: true, runValidators: true }
    );
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    res.json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/widget-api-key", canAccessCompany, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id).select("+widgetApiKeyHash");
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    const apiKey = createWidgetApiKey();
    company.widgetApiKeyHash = hashApiKey(apiKey);
    company.widgetApiKeyPreview = `${apiKey.slice(0, 10)}...${apiKey.slice(-6)}`;
    await company.save();

    res.json({
      apiKey,
      widgetApiKeyPreview: company.widgetApiKeyPreview,
      message: "Widget API key generated. Copy it now; it will not be shown again.",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", requireSuperAdmin, async (req, res) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    res.json({ message: "Company deleted", company });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
