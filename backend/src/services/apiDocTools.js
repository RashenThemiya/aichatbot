const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const LiveApiTool = require("../models/LiveApiTool");
const { encryptSecret } = require("./crypto");

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBaseUrl(value) {
  return normalizeWhitespace(value).replace(/\/$/, "");
}

function extractTitle(text) {
  const match = text.match(/^#\s+(.+)$/m);
  if (!match) return "Imported API";
  return normalizeWhitespace(match[1]).replace(/\s*API\s*Documentation$/i, "");
}

function splitAbsoluteUrl(value) {
  try {
    const parsed = new URL(String(value).trim());
    return {
      baseUrl: parsed.origin,
      pathTemplate: parsed.pathname || "/",
    };
  } catch {
    return null;
  }
}

function uniquePush(target, seen, item) {
  const key = `${item.in}:${item.name}`;
  if (seen.has(key)) return;
  seen.add(key);
  target.push(item);
}

function flattenSchemaProperties(schema, requiredFields = [], prefix = "") {
  const output = [];
  if (!schema || typeof schema !== "object") return output;
  if (schema.type && schema.type !== "object" && !schema.properties)
    return output;

  const properties = schema.properties || {};
  const requiredSet = new Set(
    Array.isArray(requiredFields) ? requiredFields : [],
  );

  for (const [name, property] of Object.entries(properties)) {
    const fullName = prefix ? `${prefix}.${name}` : name;
    const propertyType =
      property && typeof property === "object"
        ? property.type || property.format || "string"
        : "string";

    if (
      property &&
      typeof property === "object" &&
      property.type === "object" &&
      property.properties
    ) {
      output.push(
        ...flattenSchemaProperties(property, property.required || [], fullName),
      );
      continue;
    }

    if (
      property &&
      typeof property === "object" &&
      property.type === "array" &&
      property.items
    ) {
      if (property.items.type === "object" && property.items.properties) {
        output.push(
          ...flattenSchemaProperties(
            property.items,
            property.items.required || [],
            fullName,
          ),
        );
        continue;
      }
    }

    output.push({
      name: fullName,
      in: "body",
      required: requiredSet.has(name),
      description:
        property && typeof property === "object"
          ? [propertyType, property.description || ""]
              .filter(Boolean)
              .join(" - ")
          : String(propertyType),
    });
  }

  return output;
}

function extractFirstJsonBlock(text) {
  const match =
    text.match(/```json\s*([\s\S]*?)```/i) ||
    text.match(/```\s*([\s\S]*?)```/i);
  if (!match) return null;
  try {
    const value = JSON.parse(match[1]);
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function flattenExampleObject(value, prefix = "") {
  const output = [];
  if (!value || typeof value !== "object" || Array.isArray(value))
    return output;

  for (const [key, nested] of Object.entries(value)) {
    const fullName = prefix ? `${prefix}.${key}` : key;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      output.push(...flattenExampleObject(nested, fullName));
    } else {
      output.push(fullName);
    }
  }

  return output;
}

function extractKeywords(text, limit = 8) {
  const words = normalizeWhitespace(text)
    .split(/[^a-zA-Z0-9]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2);

  const result = [];
  const seen = new Set();
  for (const word of words) {
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(word);
    if (result.length >= limit) break;
  }
  return result;
}

function inferAuthFromText(text) {
  const lowered = text.toLowerCase();
  if (lowered.includes("authorization") && lowered.includes("bearer")) {
    return {
      authType: "bearer",
      authHeaderName: "Authorization",
      authValuePrefix: "Bearer ",
    };
  }

  if (lowered.includes("x-api-key") || lowered.includes("api key")) {
    return {
      authType: "api-key",
      authHeaderName: "X-API-Key",
      authValuePrefix: "",
    };
  }

  return {
    authType: "none",
    authHeaderName: "Authorization",
    authValuePrefix: "Bearer ",
  };
}

function inferAuthFromSpec(spec, rawText) {
  const schemes =
    spec?.components?.securitySchemes ||
    spec?.securityDefinitions ||
    spec?.components?.schemas?.securitySchemes ||
    {};
  const security = Array.isArray(spec?.security) ? spec.security : [];
  const selectedName =
    Object.keys((Array.isArray(security) && security[0]) || {})[0] ||
    Object.keys(schemes)[0] ||
    "";
  const scheme = selectedName ? schemes[selectedName] : null;

  if (scheme && typeof scheme === "object") {
    const type = String(scheme.type || "").toLowerCase();
    if (
      type === "http" &&
      String(scheme.scheme || "").toLowerCase() === "bearer"
    ) {
      return {
        authType: "bearer",
        authHeaderName: "Authorization",
        authValuePrefix: "Bearer ",
      };
    }

    if (type === "apikey" || type === "apiKey".toLowerCase()) {
      if (String(scheme.in || "").toLowerCase() === "header") {
        return {
          authType: "api-key",
          authHeaderName: scheme.name || "X-API-Key",
          authValuePrefix: "",
        };
      }
    }
  }

  return inferAuthFromText(rawText);
}

function resolveBaseUrlFromSpec(spec, rawText, fallbackPath = "") {
  const serverUrl =
    spec?.servers?.[0]?.url ||
    spec?.baseUrl ||
    spec?.baseURL ||
    spec?.host ||
    "";

  if (serverUrl) {
    const normalized = normalizeBaseUrl(serverUrl);
    const split = splitAbsoluteUrl(normalized);
    if (split) return split;
    return {
      baseUrl: normalized,
      pathTemplate: fallbackPath || "/",
    };
  }

  const markdownMatch = rawText.match(
    /^\s*(?:Base URL|Base Url|BaseURL|Server|Server URL)\s*:\s*(.+)$/im,
  );
  if (markdownMatch) {
    const normalized = normalizeBaseUrl(markdownMatch[1]);
    const split = splitAbsoluteUrl(normalized);
    if (split) return split;
    return {
      baseUrl: normalized,
      pathTemplate: fallbackPath || "/",
    };
  }

  return null;
}

function parseOperationParameters(operation) {
  const parameters = [];
  const seen = new Set();

  for (const parameter of operation?.parameters || []) {
    if (!parameter || !parameter.name || !parameter.in) continue;
    uniquePush(parameters, seen, {
      name: String(parameter.name),
      in: String(parameter.in),
      required: Boolean(parameter.required),
      description: normalizeWhitespace(parameter.description || ""),
    });
  }

  const requestBody = operation?.requestBody?.content || {};
  const jsonSchema = requestBody["application/json"]?.schema;
  const formSchema = requestBody["application/x-www-form-urlencoded"]?.schema;
  const schema = jsonSchema || formSchema;
  if (schema) {
    const flattened = flattenSchemaProperties(schema, schema.required || []);
    for (const item of flattened) {
      uniquePush(parameters, seen, item);
    }
  }

  return parameters;
}

function makeToolName(documentTitle, method, pathTemplate) {
  const cleanTitle = normalizeWhitespace(documentTitle || "Imported API");
  const cleanPath = normalizeWhitespace(pathTemplate || "/");
  const value = `${cleanTitle} - ${method} ${cleanPath}`;
  return value.length > 120 ? value.slice(0, 117).trimEnd() + "..." : value;
}

function buildKeywordHints(
  documentTitle,
  operation,
  pathTemplate,
  description,
) {
  const hints = new Set();
  for (const value of [
    documentTitle,
    operation?.summary,
    operation?.description,
    pathTemplate,
    description,
  ]) {
    for (const keyword of extractKeywords(value || "")) {
      hints.add(keyword);
    }
  }
  return Array.from(hints).slice(0, 12);
}

function parseOpenApiSpec(spec, rawText, documentTitle) {
  const tools = [];
  const base = resolveBaseUrlFromSpec(spec, rawText);
  if (!base?.baseUrl) return tools;

  const auth = inferAuthFromSpec(spec, rawText);
  const paths = spec?.paths || {};

  for (const [route, methods] of Object.entries(paths)) {
    if (!methods || typeof methods !== "object") continue;

    for (const [methodName, operation] of Object.entries(methods)) {
      const method = String(methodName || "").toUpperCase();
      if (!METHODS.has(method)) continue;

      const params = parseOperationParameters(operation);
      const description = normalizeWhitespace(
        operation?.summary || operation?.description || "",
      );
      const pathTemplate = String(route || "/").trim();
      tools.push({
        name: makeToolName(documentTitle, method, pathTemplate),
        description: description || `${method} ${pathTemplate}`,
        method,
        baseUrl: base.baseUrl,
        pathTemplate,
        parameters: params,
        staticQuery: {},
        staticBody: {},
        staticHeaders: {},
        authType: auth.authType,
        authHeaderName: auth.authHeaderName,
        authValuePrefix: auth.authValuePrefix,
        keywordHints: buildKeywordHints(
          documentTitle,
          operation,
          pathTemplate,
          description,
        ),
      });
    }
  }

  return tools;
}

function parseMarkdownParameters(blockText, sectionName) {
  const lines = blockText.split(/\r?\n/);
  const startIndex = lines.findIndex((line) =>
    new RegExp(`^#{2,6}\\s*${sectionName}\\s*$`, "i").test(line.trim()),
  );
  if (startIndex === -1) return [];

  const params = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/^#{1,6}\s+/.test(line) || /^---+$/.test(line)) break;
    if (/^```/.test(line)) continue;

    const bullet = line.match(/^[-*]\s*(.+)$/);
    if (!bullet) continue;

    const raw = bullet[1];
    const colonMatch = raw.match(/^([^:]+?)\s*:\s*(.+)$/);
    const dashMatch = raw.match(/^([^\-]+?)\s*-\s*(.+)$/);
    const name = normalizeWhitespace(
      (colonMatch || dashMatch || [])[1] || raw.split(/\s+/)[0] || "",
    );
    const description = normalizeWhitespace(
      (colonMatch || dashMatch || [])[2] || raw,
    );
    if (!name) continue;

    params.push({
      name,
      in: sectionName.toLowerCase().includes("path")
        ? "path"
        : sectionName.toLowerCase().includes("query")
          ? "query"
          : sectionName.toLowerCase().includes("header")
            ? "query"
            : "body",
      required: /required/i.test(raw),
      description,
    });
  }

  return params;
}

function parseMarkdownOperation(
  blockText,
  documentTitle,
  fallbackBaseUrl,
  auth,
) {
  const heading = blockText.match(
    /^#{1,6}\s*(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/im,
  );
  if (!heading) return null;

  const method = heading[1].toUpperCase();
  const rawPath = normalizeWhitespace(heading[2]);
  let baseUrl = fallbackBaseUrl;
  let pathTemplate = rawPath;

  const absolute = splitAbsoluteUrl(rawPath);
  if (absolute) {
    baseUrl = absolute.baseUrl;
    pathTemplate = absolute.pathTemplate;
  }

  if (!baseUrl) return null;

  const descriptionMatch = blockText
    .slice(heading.index + heading[0].length)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(
      (line) =>
        line &&
        !/^#{1,6}\s+/.test(line) &&
        line !== "---" &&
        !/^```/.test(line),
    );

  const pathParams = parseMarkdownParameters(blockText, "Path Parameters");
  const queryParams = parseMarkdownParameters(blockText, "Query Parameters");
  const headerParams = parseMarkdownParameters(blockText, "Headers");

  const bodyJson = extractFirstJsonBlock(blockText);
  const bodyKeys = bodyJson ? flattenExampleObject(bodyJson) : [];
  const bodyParams = bodyKeys.map((name) => ({
    name,
    in: "body",
    required: true,
    description: "Example request field",
  }));

  const parameters = [
    ...pathParams,
    ...queryParams,
    ...headerParams,
    ...bodyParams,
  ];
  return {
    name: makeToolName(documentTitle, method, pathTemplate),
    description: descriptionMatch || `${method} ${pathTemplate}`,
    method,
    baseUrl,
    pathTemplate,
    parameters,
    staticQuery: {},
    staticBody: {},
    staticHeaders: {},
    authType: auth.authType,
    authHeaderName: auth.authHeaderName,
    authValuePrefix: auth.authValuePrefix,
    keywordHints: buildKeywordHints(
      documentTitle,
      null,
      pathTemplate,
      descriptionMatch,
    ),
  };
}

function extractMarkdownBlocks(rawText) {
  const matches = Array.from(
    rawText.matchAll(/^#{1,6}\s*(GET|POST|PUT|PATCH|DELETE)\s+.+$/gim),
  );
  if (!matches.length) return [];

  const blocks = [];
  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const next = matches[i + 1];
    const start = current.index || 0;
    const end = next?.index ?? rawText.length;
    blocks.push(rawText.slice(start, end));
  }
  return blocks;
}

function parseMarkdownDoc(rawText, documentName) {
  const documentTitle = extractTitle(rawText) || documentName || "Imported API";
  const baseUrlMatch = rawText.match(
    /^\s*(?:Base URL|Base Url|BaseURL|Server|Server URL)\s*:\s*(.+)$/im,
  );
  const baseUrl = baseUrlMatch ? normalizeBaseUrl(baseUrlMatch[1]) : "";
  const auth = inferAuthFromText(rawText);
  const blocks = extractMarkdownBlocks(rawText);
  const tools = [];

  for (const block of blocks) {
    const tool = parseMarkdownOperation(block, documentTitle, baseUrl, auth);
    if (tool) tools.push(tool);
  }

  return tools;
}

function parseApiDocTools({ filePath, documentName }) {
  const rawText = readText(filePath);
  const documentTitle =
    extractTitle(rawText) || documentName || path.basename(filePath);

  const parsedJson = (() => {
    try {
      return JSON.parse(rawText);
    } catch {
      return null;
    }
  })();

  if (parsedJson && typeof parsedJson === "object") {
    const jsonTools = parseOpenApiSpec(parsedJson, rawText, documentTitle);
    if (jsonTools.length) return jsonTools;
  }

  try {
    const parsedYaml = yaml.load(rawText);
    if (parsedYaml && typeof parsedYaml === "object") {
      const yamlTools = parseOpenApiSpec(parsedYaml, rawText, documentTitle);
      if (yamlTools.length) return yamlTools;
    }
  } catch {
    // Fall back to markdown/text heuristics below.
  }

  return parseMarkdownDoc(rawText, documentName || documentTitle);
}

async function syncApiDocTools({
  companyId,
  documentId,
  filePath,
  documentName,
  // OAuth2 / auth credentials applied to every generated tool
  authSecret,
  refreshToken,
  clientId,
  clientSecret,
  tokenRefreshUrl,
  tokenExpiresAt,
  // Extra headers merged into staticHeaders on every tool (e.g. Zoho org ID)
  staticHeaders,
}) {
  await LiveApiTool.deleteMany({
    companyId,
    sourceDocumentId: documentId,
    generatedFromDocument: true,
  });

  const tools = parseApiDocTools({ filePath, documentName });
  if (!tools.length) {
    return {
      tools: [],
      generatedCount: 0,
      skipped: true,
    };
  }

  // Build the credential patch applied uniformly to all generated tools
  const credentialPatch = {};
  if (authSecret)       credentialPatch.encryptedAuthSecret       = encryptSecret(authSecret);
  if (refreshToken)     credentialPatch.encryptedRefreshToken     = encryptSecret(refreshToken);
  if (clientId)         credentialPatch.tokenClientId             = String(clientId);
  if (clientSecret)     credentialPatch.encryptedTokenClientSecret = encryptSecret(clientSecret);
  if (tokenRefreshUrl)  credentialPatch.tokenRefreshUrl           = String(tokenRefreshUrl);
  if (tokenExpiresAt)   credentialPatch.tokenExpiresAt            = new Date(tokenExpiresAt);

  const extraHeaders = staticHeaders && typeof staticHeaders === "object" ? staticHeaders : {};

  const created = await LiveApiTool.insertMany(
    tools.map((tool) => ({
      companyId,
      sourceDocumentId: documentId,
      generatedFromDocument: true,
      isEnabled: true,
      timeoutMs: 10000,
      ...tool,
      staticHeaders: { ...(tool.staticHeaders || {}), ...extraHeaders },
      ...credentialPatch,
    })),
  );

  return {
    tools: created,
    generatedCount: created.length,
    skipped: false,
  };
}

async function deleteApiDocTools({ companyId, documentId }) {
  const result = await LiveApiTool.deleteMany({
    companyId,
    sourceDocumentId: documentId,
    generatedFromDocument: true,
  });
  return result.deletedCount || 0;
}

module.exports = {
  deleteApiDocTools,
  syncApiDocTools,
  parseApiDocTools,
};
