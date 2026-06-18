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

async function ensureCompany(companyId) {
  return Company.findById(companyId);
}

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const company = await ensureCompany(req.params.companyId);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "PDF file is required (field: file)" });
    }

    const doc = await Document.create({
      companyId: company._id,
      originalName: req.file.originalname,
      fileName: req.file.filename,
      filePath: path.resolve(req.file.path),
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      status: "indexing",
    });

    try {
      const result = await ragClient.ingestDocument({
        companyId: company._id.toString(),
        documentId: doc._id.toString(),
        filePath: doc.filePath,
        documentName: doc.originalName,
      });

      doc.status = "indexed";
      doc.chunksIndexed = result.chunks_indexed;
      await doc.save();

      res.status(201).json(doc);
    } catch (indexErr) {
      doc.status = "failed";
      doc.indexError = indexErr.response?.data?.detail || indexErr.message;
      await doc.save();
      res.status(502).json({
        error: "Document saved but indexing failed",
        document: doc,
        detail: doc.indexError,
      });
    }
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
