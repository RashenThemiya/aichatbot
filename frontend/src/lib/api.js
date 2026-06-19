const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

let authToken = localStorage.getItem("rag_admin_token") || "";

export function setAuthToken(token) {
  authToken = token || "";
  if (authToken) localStorage.setItem("rag_admin_token", authToken);
  else localStorage.removeItem("rag_admin_token");
}

export function getAuthToken() {
  return authToken;
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  console.log("[api] request", {
    method: options.method || "GET",
    path,
    hasToken: Boolean(authToken),
  });
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  console.log("[api] response", {
    path,
    status: response.status,
    ok: response.ok,
    data,
  });

  if (!response.ok) {
    const message =
      typeof data === "string"
        ? data
        : data.error || data.detail || "Request failed";
    throw new Error(message);
  }

  return data;
}

export const api = {
  baseUrl: API_BASE_URL,
  health: () => request("/health"),
  auth: {
    login: (payload) =>
      request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    me: () => request("/api/auth/me"),
  },
  adminUsers: {
    list: () => request("/api/admin-users"),
    create: (payload) =>
      request("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    update: (id, payload) =>
      request(`/api/admin-users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    remove: (id) => request(`/api/admin-users/${id}`, { method: "DELETE" }),
  },
  companies: {
    list: () => request("/api/companies"),
    create: (payload) =>
      request("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    update: (id, payload) =>
      request(`/api/companies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    generateWidgetApiKey: (id) =>
      request(`/api/companies/${id}/widget-api-key`, {
        method: "POST",
      }),
    remove: (id) => request(`/api/companies/${id}`, { method: "DELETE" }),
  },
  documents: {
    list: (companyId) => request(`/api/companies/${companyId}/documents`),
    upload: (companyId, file, docType = "pdf") => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("docType", docType);
      return request(`/api/companies/${companyId}/documents`, {
        method: "POST",
        body: formData,
      });
    },
    reindex: (companyId, documentId) =>
      request(`/api/companies/${companyId}/documents/${documentId}/reindex`, {
        method: "POST",
      }),
    remove: (companyId, documentId) =>
      request(`/api/companies/${companyId}/documents/${documentId}`, {
        method: "DELETE",
      }),
  },
  liveApiTools: {
    list: (companyId) => request(`/api/companies/${companyId}/live-api-tools`),
    create: (companyId, payload) =>
      request(`/api/companies/${companyId}/live-api-tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    update: (companyId, toolId, payload) =>
      request(`/api/companies/${companyId}/live-api-tools/${toolId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    remove: (companyId, toolId) =>
      request(`/api/companies/${companyId}/live-api-tools/${toolId}`, {
        method: "DELETE",
      }),
  },
  chat: {
    ask: (companyId, payload) =>
      request(`/api/companies/${companyId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    conversations: (companyId) =>
      request(`/api/companies/${companyId}/chat/conversations`),
    history: (companyId, sessionId) =>
      request(`/api/companies/${companyId}/chat/history/${sessionId}`),
  },
};

export function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
