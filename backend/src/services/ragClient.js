const axios = require("axios");
const config = require("../config");

const client = axios.create({
  baseURL: config.ragServiceUrl,
  timeout: 120000,
});

async function ingestDocument({ companyId, documentId, filePath, documentName }) {
  const { data } = await client.post("/ingest", {
    company_id: companyId,
    document_id: documentId,
    file_path: filePath,
    document_name: documentName,
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

async function queryKnowledge({ companyId, question, topK }) {
  const { data } = await client.post("/query", {
    company_id: companyId,
    question,
    top_k: topK,
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
