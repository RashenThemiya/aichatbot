const axios = require("axios");
const config = require("../config");

const client = axios.create({
  baseURL: config.ragServiceUrl,
  timeout: Number(process.env.RAG_REQUEST_TIMEOUT_MS || 300000),
});

async function ingestDocument({
  companyId,
  documentId,
  filePath,
  documentName,
  documentVersion,
  effectiveDate,
  isActive,
}) {
  const { data } = await client.post("/ingest", {
    company_id: companyId,
    document_id: documentId,
    file_path: filePath,
    document_name: documentName,
    document_version: documentVersion || "1",
    effective_date: effectiveDate || "",
    is_active: isActive !== false,
  });
  return data;
}

async function deleteDocumentVectors({ companyId, documentId }) {
  const { data } = await client.delete("/documents", {
    data: {
      company_id: companyId,
      document_id: documentId,
    },
  });
  return data;
}

async function queryKnowledge({ companyId, question, topK, history }) {
  const { data } = await client.post("/query", {
    company_id: companyId,
    question,
    top_k: topK,
    history: history || [],
  });
  return data;
}

async function checkHealth() {
  const { data } = await client.get("/health");
  return data;
}

module.exports = {
  ingestDocument,
  deleteDocumentVectors,
  queryKnowledge,
  checkHealth,
};
