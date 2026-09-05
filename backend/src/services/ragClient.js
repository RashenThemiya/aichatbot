const axios = require("axios");
const crypto = require("crypto");
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

function buildQueryCacheKey({ companyId, question, topK, history, preferredDocumentIds }) {
  const historyText = (history || []).slice(-16).join("\n").toLowerCase();
  const historyKey = crypto.createHash("sha256").update(historyText).digest("hex");
  return JSON.stringify({
    version: process.env.RAG_QUERY_CACHE_VERSION || "product-document-scope-v1",
    companyId,
    question: normalizeQuestion(question),
    topK: topK || null,
    history: historyKey,
    preferredDocumentIds: [...new Set(preferredDocumentIds || [])].sort(),
  });
}

function buildConversationRagContext(messages = []) {
  const recent = messages.slice(-16);
  const history = recent.map((item) => `${item.role}: ${item.content}`);
  let preferredDocumentIds = [];

  // Use the closest earlier answer that actually cited documents. The RAG
  // service applies this scope only to an incomplete/generic follow-up, so a
  // newly named product can still start a clean topic.
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const message = recent[index];
    if (message.role !== "assistant" || !message.sources?.length) continue;
    preferredDocumentIds = [...new Set(
      message.sources.map((source) => String(source.documentId || "").trim()).filter(Boolean)
    )];
    break;
  }

  return { history, preferredDocumentIds };
}

function rememberQuery(cacheKey, data, companyId) {
  if (queryCacheTtlMs <= 0 || !data?.answer) return;

  while (queryCache.size >= queryCacheMaxEntries) {
    const oldestKey = queryCache.keys().next().value;
    if (!oldestKey) break;
    queryCache.delete(oldestKey);
  }

  queryCache.set(cacheKey, {
    data,
    companyId: String(companyId),
    expiresAt: Date.now() + queryCacheTtlMs,
  });
}

function invalidateCompanyCache(companyId) {
  const target = String(companyId);
  for (const [key, cached] of queryCache.entries()) {
    if (cached.companyId === target) queryCache.delete(key);
  }
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
      invalidateCompanyCache(companyId);
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
  invalidateCompanyCache(companyId);
  return data;
}

async function setDocumentActive({ companyId, documentId, isActive }) {
  const { data } = await client.patch("/documents/active", {
    company_id: companyId,
    document_id: documentId,
    is_active: isActive,
  });
  invalidateCompanyCache(companyId);
  return data;
}

async function queryKnowledge({ companyId, question, topK, history, preferredDocumentIds }) {
  const cacheKey = buildQueryCacheKey({
    companyId,
    question,
    topK,
    history,
    preferredDocumentIds,
  });
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
    preferred_document_ids: preferredDocumentIds || [],
  });

  rememberQuery(cacheKey, data, companyId);

  return data;
}

async function checkHealth() {
  const { data } = await client.get("/health");
  return data;
}

module.exports = {
  ingestDocument,
  deleteDocumentVectors,
  setDocumentActive,
  queryKnowledge,
  buildConversationRagContext,
  checkHealth,
  invalidateCompanyCache,
};
