const axios = require("axios");
const config = require("../config");
const { decryptSecret } = require("./crypto");

function sanitizeToolsForPlanner(tools) {
  return tools
    .filter((tool) => tool.isEnabled)
    .map((tool) => ({
      id: tool._id.toString(),
      name: tool.name,
      description: tool.description || "",
      method: tool.method,
      base_url: tool.baseUrl,
      path_template: tool.pathTemplate,
      keyword_hints: tool.keywordHints || [],
      parameters: (tool.parameters || []).map((param) => ({
        name: param.name,
        in: param.in,
        required: Boolean(param.required),
        description: param.description || "",
      })),
    }));
}

function mergeObject(baseValue, dynamicValue) {
  const base = baseValue && typeof baseValue === "object" ? baseValue : {};
  const dynamic =
    dynamicValue && typeof dynamicValue === "object" ? dynamicValue : {};
  return { ...base, ...dynamic };
}

function applyPathParams(pathTemplate, pathParams) {
  const values = pathParams && typeof pathParams === "object" ? pathParams : {};
  return pathTemplate.replace(/\{([^}]+)\}/g, (_m, key) => {
    const raw = values[key];
    if (raw === undefined || raw === null || raw === "") {
      throw new Error(`Missing required path param: ${key}`);
    }
    return encodeURIComponent(String(raw));
  });
}

function assertRequiredParams(tool, plan) {
  const params = tool.parameters || [];
  const path = plan.path_params || {};
  const query = plan.query_params || {};
  const body = plan.body_params || {};

  for (const param of params) {
    if (!param.required) continue;
    let hasValue = false;
    if (param.in === "path")
      hasValue = path[param.name] !== undefined && path[param.name] !== "";
    if (param.in === "query")
      hasValue = query[param.name] !== undefined && query[param.name] !== "";
    if (param.in === "body")
      hasValue = body[param.name] !== undefined && body[param.name] !== "";
    if (!hasValue) {
      throw new Error(`Missing required ${param.in} parameter: ${param.name}`);
    }
  }
}

function buildAuthHeaders(tool) {
  if (tool.authType === "none") return {};
  const secret = decryptSecret(tool.encryptedAuthSecret || "");
  if (!secret) {
    throw new Error(`Missing auth secret for tool: ${tool.name}`);
  }

  if (tool.authType === "bearer") {
    return {
      [tool.authHeaderName || "Authorization"]:
        `${tool.authValuePrefix || "Bearer "}${secret}`,
    };
  }

  if (tool.authType === "api-key") {
    const header = tool.authHeaderName || "X-API-Key";
    return { [header]: secret };
  }

  return {};
}

function sanitizeResponse(data) {
  if (data === null || data === undefined) return null;
  if (typeof data === "string") return data.slice(0, 8000);
  if (typeof data !== "object") return data;

  const output = Array.isArray(data) ? data.slice(0, 40) : {};
  const entries = Array.isArray(output)
    ? output.entries()
    : Object.entries(data).slice(0, 80);

  for (const [key, value] of entries) {
    const name = String(key).toLowerCase();
    if (
      name.includes("password") ||
      name.includes("secret") ||
      name.includes("token") ||
      name.includes("api_key") ||
      name.includes("apikey")
    ) {
      if (Array.isArray(output)) output[key] = "[REDACTED]";
      else output[key] = "[REDACTED]";
      continue;
    }

    const sanitized =
      typeof value === "object" && value !== null
        ? JSON.parse(JSON.stringify(value))
        : value;
    if (Array.isArray(output)) output[key] = sanitized;
    else output[key] = sanitized;
  }
  return output;
}

async function executePlannedTool(tool, plan) {
  assertRequiredParams(tool, plan);

  const path = applyPathParams(tool.pathTemplate, plan.path_params || {});
  const baseUrl = String(tool.baseUrl || "").replace(/\/$/, "");
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const query = mergeObject(tool.staticQuery, plan.query_params || {});
  const body = mergeObject(tool.staticBody, plan.body_params || {});
  const headers = {
    ...mergeObject(tool.staticHeaders, plan.headers || {}),
    ...buildAuthHeaders(tool),
  };

  const response = await axios({
    url,
    method: tool.method,
    params: query,
    data: ["GET", "DELETE"].includes(tool.method) ? undefined : body,
    headers,
    timeout: Math.min(tool.timeoutMs || config.liveApiTimeoutMs, 30000),
    validateStatus: () => true,
  });

  return {
    toolId: tool._id.toString(),
    toolName: tool.name,
    method: tool.method,
    url,
    status: response.status,
    ok: response.status >= 200 && response.status < 300,
    response: sanitizeResponse(response.data),
  };
}

module.exports = {
  sanitizeToolsForPlanner,
  executePlannedTool,
};
