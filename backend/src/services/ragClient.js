const axios = require("axios");
const config = require("../config");

const client = axios.create({
  baseURL: config.ragServiceUrl,
  timeout: Number(process.env.RAG_REQUEST_TIMEOUT_MS || 900000),
});

const ingestMaxAttempts = Number(process.env.RAG_INGEST_MAX_ATTEMPTS || 4);
const ingestRetryBaseMs = Number(process.env.RAG_INGEST_RETRY_BASE_MS || 1000);

function isTransientIngestError(error) {
  const status = error.response?.status;
  return !status || status === 408 || status === 429 || status >= 500;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const queryCache = new Map();
const queryCacheTtlMs = Number(process.env.RAG_QUERY_CACHE_TTL_MS || 5 * 60 * 1000);
const queryCacheMaxEntries = Number(process.env.RAG_QUERY_CACHE_MAX_ENTRIES || 250);

function normalizeQuestion(question) {
  return String(question || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function buildQueryCacheKey({ companyId, question, topK, history }) {
  const historyKey = (history || []).slice(-2).join("\n").toLowerCase();
  return JSON.stringify({
    companyId,
    question: normalizeQuestion(question),
    topK: topK || null,
    history: historyKey,
  });
}

function rememberQuery(cacheKey, data) {
  if (queryCacheTtlMs <= 0 || !data?.answer) return;

  while (queryCache.size >= queryCacheMaxEntries) {
    const oldestKey = queryCache.keys().next().value;
    if (!oldestKey) break;
    queryCache.delete(oldestKey);
  }

  queryCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + queryCacheTtlMs,
  });
}

async function ingestDocument({
  companyId,
  documentId,
  filePath,
  documentName,
  documentVersion,
  effectiveDate,
  isActive,
}) {
  const payload = {
    company_id: companyId,
    document_id: documentId,
    file_path: filePath,
    document_name: documentName,
    document_version: documentVersion || "1",
    effective_date: effectiveDate || "",
    is_active: isActive !== false,
  };

  let lastError;
  for (let attempt = 1; attempt <= ingestMaxAttempts; attempt += 1) {
    try {
      const { data } = await client.post("/ingest", payload);
      return data;
    } catch (error) {
      lastError = error;
      if (!isTransientIngestError(error) || attempt === ingestMaxAttempts) throw error;
      await wait(ingestRetryBaseMs * (2 ** (attempt - 1)));
    }
  }
  throw lastError;
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
  const cacheKey = buildQueryCacheKey({ companyId, question, topK, history });
  const cached = queryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.data,
      diagnostics: {
        ...(cached.data.diagnostics || {}),
        cache: { hit: true, ttlMs: queryCacheTtlMs },
      },
    };
  }

  const { data } = await client.post("/query", {
    company_id: companyId,
    question,
    top_k: topK,
    history: history || [],
  });

  rememberQuery(cacheKey, data);

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
