const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const config = require("../config");
const Company = require("../models/Company");
const Document = require("../models/Document");
const ragClient = require("../services/ragClient");
const { canAccessCompany } = require("../middleware/auth");

const router = express.Router({ mergeParams: true });

router.use(canAccessCompany);

function companyUploadDir(companyId) {
  const dir = path.join(config.uploadDir, companyId.toString());
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    cb(null, companyUploadDir(req.params.companyId));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

function normalizeRelativeName(value) {
  const normalized = String(value || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");

  return normalized || "";
}

async function ensureCompany(companyId) {
  return Company.findById(companyId);
}

async function createAndIndexDocument(
  company,
  file,
  originalName = file.originalname,
  metadata = {}
) {
  const doc = await Document.create({
    companyId: company._id,
    originalName,
    fileName: file.filename,
    filePath: path.resolve(file.path),
    mimeType: file.mimetype,
    fileSize: file.size,
    status: "indexing",
    documentVersion: metadata.documentVersion || "1",
    effectiveDate: metadata.effectiveDate || null,
    isActive: metadata.isActive !== false && metadata.isActive !== "false",
  });

  try {
    const result = await ragClient.ingestDocument({
      companyId: company._id.toString(),
      documentId: doc._id.toString(),
      filePath: doc.filePath,
      documentName: doc.originalName,
      documentVersion: doc.documentVersion,
      effectiveDate: doc.effectiveDate?.toISOString() || "",
      isActive: doc.isActive,
    });

    doc.status = "indexed";
    doc.chunksIndexed = result.chunks_indexed;
    await doc.save();

    return { ok: true, document: doc };
  } catch (indexErr) {
    doc.status = "failed";
    doc.indexError = indexErr.response?.data?.detail || indexErr.message;
    await doc.save();

    return {
      ok: false,
      error: "Document saved but indexing failed",
      document: doc,
      detail: doc.indexError,
    };
  }
}

router.post(
  "/",
  upload.fields([
    { name: "files", maxCount: 200 },
    { name: "file", maxCount: 1 },
  ]),
  async (req, res) => {
  try {
    const company = await ensureCompany(req.params.companyId);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    const files = [...(req.files?.files || []), ...(req.files?.file || [])];
    if (files.length === 0) {
      return res.status(400).json({ error: "At least one PDF file is required (field: files)" });
    }

    const relativePaths = Array.isArray(req.body.relativePaths)
      ? req.body.relativePaths
      : req.body.relativePaths
        ? [req.body.relativePaths]
        : [];
    const results = [];
    for (const [index, file] of files.entries()) {
      const relativeName = normalizeRelativeName(relativePaths[index]);
      results.push(await createAndIndexDocument(
        company,
        file,
        relativeName || file.originalname,
        {
          documentVersion: req.body.documentVersion,
          effectiveDate: req.body.effectiveDate,
          isActive: req.body.isActive,
        }
      ));
    }

    const failed = results.filter((result) => !result.ok);
    const documents = results.map((result) => result.document);

    if (files.length === 1) {
      const [result] = results;
      if (result.ok) return res.status(201).json(result.document);
      res.status(502).json({
        error: result.error,
        document: result.document,
        detail: result.detail,
      });
      return;
    }

    res.status(failed.length ? 207 : 201).json({
      message: failed.length
        ? `${documents.length - failed.length} of ${documents.length} documents uploaded and indexed`
        : `${documents.length} documents uploaded and indexed`,
      documents,
      failed,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const company = await ensureCompany(req.params.companyId);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    const documents = await Document.find({ companyId: company._id }).sort({
      createdAt: -1,
    });
    res.json(documents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:documentId", async (req, res) => {
  try {
    const doc = await Document.findOne({
      _id: req.params.documentId,
      companyId: req.params.companyId,
    });
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/bulk", async (req, res) => {
  try {
    const documentIds = Array.from(new Set(
      (Array.isArray(req.body.documentIds) ? req.body.documentIds : [])
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    ));
    if (documentIds.length === 0) {
      return res.status(400).json({ error: "At least one document ID is required" });
    }
    if (documentIds.length > 200) {
      return res.status(400).json({ error: "A maximum of 200 documents can be deleted at once" });
    }

    const documents = await Document.find({
      _id: { $in: documentIds },
      companyId: req.params.companyId,
    });

    for (const doc of documents) {
      try {
        await ragClient.deleteDocumentVectors({
          companyId: req.params.companyId,
          documentId: doc._id.toString(),
        });
      } catch (ragErr) {
        console.warn(`RAG delete warning for ${doc._id}:`, ragErr.message);
      }
      if (fs.existsSync(doc.filePath)) {
        fs.unlinkSync(doc.filePath);
      }
    }

    await Document.deleteMany({
      _id: { $in: documents.map((doc) => doc._id) },
      companyId: req.params.companyId,
    });

    res.json({
      message: `${documents.length} document${documents.length === 1 ? "" : "s"} deleted`,
      deletedCount: documents.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:documentId", async (req, res) => {
  try {
    const doc = await Document.findOne({
      _id: req.params.documentId,
      companyId: req.params.companyId,
    });
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    try {
      await ragClient.deleteDocumentVectors({
        companyId: req.params.companyId,
        documentId: doc._id.toString(),
      });
    } catch (ragErr) {
      console.warn("RAG delete warning:", ragErr.message);
    }

    if (fs.existsSync(doc.filePath)) {
      fs.unlinkSync(doc.filePath);
    }

    await doc.deleteOne();
    res.json({ message: "Document deleted", documentId: req.params.documentId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:documentId/reindex", async (req, res) => {
  try {
    const doc = await Document.findOne({
      _id: req.params.documentId,
      companyId: req.params.companyId,
    });
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }
    if (!fs.existsSync(doc.filePath)) {
      return res.status(404).json({ error: "PDF file missing on disk" });
    }

    doc.status = "indexing";
    doc.indexError = null;
    await doc.save();

    try {
      const result = await ragClient.ingestDocument({
        companyId: req.params.companyId,
        documentId: doc._id.toString(),
        filePath: doc.filePath,
        documentName: doc.originalName,
        documentVersion: doc.documentVersion,
        effectiveDate: doc.effectiveDate?.toISOString() || "",
        isActive: doc.isActive,
      });

      doc.status = "indexed";
      doc.chunksIndexed = result.chunks_indexed;
      await doc.save();
      res.json(doc);
    } catch (indexErr) {
      doc.status = "failed";
      doc.indexError = indexErr.response?.data?.detail || indexErr.message;
      await doc.save();
      res.status(502).json({ error: "Reindex failed", detail: doc.indexError });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
