const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://botbackend.pentarixlabs.com";

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
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
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
    const message = typeof data === "string" ? data : data.error || data.detail || "Request failed";
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    error.path = path;
    throw error;
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
    updateWidgetTheme: async (id, payload) => {
      const options = {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      };

      try {
        return await request(`/api/companies/${id}/widget-theme`, options);
      } catch (err) {
        const routeMissing =
          err.status === 405 ||
          (err.status === 404 && String(err.message || "").includes("Cannot PUT"));

        if (!routeMissing) throw err;

        return request(`/api/companies/${id}`, {
          ...options,
          body: JSON.stringify({ widgetTheme: payload }),
        });
      }
    },
    generateWidgetApiKey: (id) =>
      request(`/api/companies/${id}/widget-api-key`, {
        method: "POST",
      }),
    remove: (id) => request(`/api/companies/${id}`, { method: "DELETE" }),
  },
  whatsappIntegration: {
    get: (companyId) => request(`/api/companies/${companyId}/whatsapp-integration`),
    save: (companyId, payload, hasExisting) =>
      request(`/api/companies/${companyId}/whatsapp-integration`, {
        method: hasExisting ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    validate: (companyId) =>
      request(`/api/companies/${companyId}/whatsapp-integration/validate`, {
        method: "POST",
      }),
    remove: (companyId) =>
      request(`/api/companies/${companyId}/whatsapp-integration`, {
        method: "DELETE",
      }),
  },

  smsIntegration: {
    get: (companyId) => request(`/api/companies/${companyId}/sms-integration`),
    save: (companyId, payload, hasExisting) =>
      request(`/api/companies/${companyId}/sms-integration`, {
        method: hasExisting ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    validate: (companyId) =>
      request(`/api/companies/${companyId}/sms-integration/validate`, {
        method: "POST",
      }),
    remove: (companyId) =>
      request(`/api/companies/${companyId}/sms-integration`, {
        method: "DELETE",
      }),
  },
  documents: {
    list: (companyId) => request(`/api/companies/${companyId}/documents`),
    upload: (companyId, file) => {
      const formData = new FormData();
      formData.append("file", file);
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
  chat: {
    ask: (companyId, payload) =>
      request(`/api/companies/${companyId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    conversations: (companyId, search = "") => {
      const query = search ? `?search=${encodeURIComponent(search)}` : "";
      return request(`/api/companies/${companyId}/chat/conversations${query}`);
    },
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
