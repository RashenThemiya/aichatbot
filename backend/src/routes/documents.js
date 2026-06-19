const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const config = require("../config");
const Company = require("../models/Company");
const Document = require("../models/Document");
const ragClient = require("../services/ragClient");
const {
  deleteApiDocTools,
  syncApiDocTools,
} = require("../services/apiDocTools");
const { canAccessCompany } = require("../middleware/auth");

const router = express.Router({ mergeParams: true });

router.use(canAccessCompany);

const API_DOC_EXTENSIONS = new Set([".json", ".yaml", ".yml", ".md", ".txt"]);
const API_DOC_MIME_TYPES = new Set([
  "application/json",
  "application/yaml",
  "application/x-yaml",
  "text/yaml",
  "text/x-yaml",
  "text/plain",
  "text/markdown",
]);

function inferDocType(file, requestedDocType = "") {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (requestedDocType === "api") return "api";
  if (file.mimetype === "application/pdf" || ext === ".pdf") return "pdf";
  if (API_DOC_EXTENSIONS.has(ext) || API_DOC_MIME_TYPES.has(file.mimetype))
    return "api";
  return "pdf";
}

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
    const ext = path.extname(file.originalname || "").toLowerCase();
    const isPdf = file.mimetype === "application/pdf" || ext === ".pdf";
    const isApiDoc =
      API_DOC_EXTENSIONS.has(ext) || API_DOC_MIME_TYPES.has(file.mimetype);
    if (isPdf || isApiDoc) {
      cb(null, true);
    } else {
      cb(new Error("Allowed file types: PDF, JSON, YAML, YML, MD, TXT"));
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
      return res
        .status(400)
        .json({ error: "Document file is required (field: file)" });
    }

    const docType = inferDocType(
      req.file,
      String(req.body?.docType || "").toLowerCase(),
    );

    const doc = await Document.create({
      companyId: company._id,
      originalName: req.file.originalname,
      fileName: req.file.filename,
      filePath: path.resolve(req.file.path),
      mimeType: req.file.mimetype,
      docType,
      fileSize: req.file.size,
      status: "indexing",
    });

    try {
      const result = await ragClient.ingestDocument({
        companyId: company._id.toString(),
        documentId: doc._id.toString(),
        filePath: doc.filePath,
        documentName: doc.originalName,
        mimeType: doc.mimeType,
        docType: doc.docType,
      });

      let apiToolResult = null;
      if (doc.docType === "api") {
        try {
          apiToolResult = await syncApiDocTools({
            companyId: company._id,
            documentId: doc._id,
            filePath: doc.filePath,
            documentName: doc.originalName,
          });
        } catch (toolErr) {
          apiToolResult = {
            generatedCount: 0,
            skipped: true,
            error: toolErr.message,
          };
        }
      }

      doc.status = "indexed";
      doc.chunksIndexed = result.chunks_indexed;
      await doc.save();

      if (apiToolResult?.error) {
        res.status(201).json({
          warning: "Document indexed but API tool generation failed",
          document: doc,
          detail: apiToolResult.error,
        });
        return;
      }

      res.status(201).json({
        document: doc,
        generatedTools: apiToolResult?.generatedCount || 0,
      });
    } catch (indexErr) {
      doc.status = "failed";
      doc.indexError = indexErr.response?.data?.detail || indexErr.message;
      await doc.save();
      res.status(201).json({
        warning: "Document saved but indexing failed",
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

    try {
      await deleteApiDocTools({
        companyId: req.params.companyId,
        documentId: doc._id,
      });
    } catch (toolErr) {
      console.warn("API doc tool delete warning:", toolErr.message);
    }

    if (fs.existsSync(doc.filePath)) {
      fs.unlinkSync(doc.filePath);
    }

    await doc.deleteOne();
    res.json({
      message: "Document deleted",
      documentId: req.params.documentId,
    });
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
      return res.status(404).json({ error: "Document file missing on disk" });
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
        mimeType: doc.mimeType,
        docType: doc.docType,
      });

      let apiToolResult = null;
      if (doc.docType === "api") {
        try {
          apiToolResult = await syncApiDocTools({
            companyId: req.params.companyId,
            documentId: doc._id,
            filePath: doc.filePath,
            documentName: doc.originalName,
          });
        } catch (toolErr) {
          apiToolResult = {
            generatedCount: 0,
            skipped: true,
            error: toolErr.message,
          };
        }
      }

      doc.status = "indexed";
      doc.chunksIndexed = result.chunks_indexed;
      await doc.save();

      if (apiToolResult?.error) {
        res.status(200).json({
          warning: "Document reindexed but API tool generation failed",
          document: doc,
          detail: apiToolResult.error,
        });
        return;
      }

      res.json({
        document: doc,
        generatedTools: apiToolResult?.generatedCount || 0,
      });
    } catch (indexErr) {
      doc.status = "failed";
      doc.indexError = indexErr.response?.data?.detail || indexErr.message;
      await doc.save();
      res.status(200).json({
        warning: "Reindex failed",
        document: doc,
        detail: doc.indexError,
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
