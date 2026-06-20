import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Building2,
  CheckCircle2,
  Clipboard,
  Code2,
  ExternalLink,
  FileText,
  History,
  KeyRound,
  Loader2,
  LogOut,
  MessageSquare,
  MoreVertical,
  Pencil,
  Power,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Smile,
  Trash2,
  Upload,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { api, formatDate } from "./lib/api";
import { getAuthToken, setAuthToken } from "./lib/api";

const emptyCompanyForm = { name: "", slug: "", description: "" };
const emptyWhatsAppForm = {
  phoneNumberId: "",
  accessToken: "",
  isActive: true,
};
const emptyLoginForm = { email: "admin@example.com", password: "admin123" };
const emptyAdminForm = {
  name: "",
  email: "",
  password: "",
  role: "company_admin",
  companyId: "",
};

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

function StatusBadge({ status }) {
  const styles = {
    indexed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    indexing: "bg-amber-50 text-amber-700 ring-amber-200",
    failed: "bg-rose-50 text-rose-700 ring-rose-200",
    ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    connected: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    unavailable: "bg-rose-50 text-rose-700 ring-rose-200",
    disconnected: "bg-rose-50 text-rose-700 ring-rose-200",
    inactive: "bg-slate-100 text-slate-600 ring-slate-200",
    unknown: "bg-slate-100 text-slate-600 ring-slate-200",
  };

  return (
    <span
      className={classNames(
        "inline-flex items-center rounded px-2 py-1 text-xs font-semibold ring-1",
        styles[status] || "bg-slate-50 text-slate-700 ring-slate-200"
      )}
    >
      {status || "-"}
    </span>
  );
}

function IconButton({ title, children, className = "", ...props }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={classNames(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm shadow-slate-200/60 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={classNames(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm shadow-slate-300/70 transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={classNames(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm shadow-slate-200/60 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function TextInput(props) {
  return (
    <input
      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
      {...props}
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      className="min-h-24 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
      {...props}
    />
  );
}

function SelectInput(props) {
  return (
    <select
      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
      {...props}
    />
  );
}

function StatCard({ icon: Icon, label, value, detail, tint = "bg-slate-100 text-slate-700" }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-4">
        <div className={classNames("flex h-14 w-14 shrink-0 items-center justify-center rounded-full", tint)}>
          <Icon size={24} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-500">{label}</div>
          <div className="mt-1 text-3xl font-bold leading-none text-slate-950">{value}</div>
          {detail && <div className="mt-2 text-xs font-medium text-slate-500">{detail}</div>}
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
          <Icon size={17} />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-1 truncate text-lg font-bold text-slate-950">{value}</div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [loginForm, setLoginForm] = useState(emptyLoginForm);
  const [authChecked, setAuthChecked] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminForm, setAdminForm] = useState(emptyAdminForm);
  const [health, setHealth] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [documents, setDocuments] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [companyForm, setCompanyForm] = useState(emptyCompanyForm);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatSessionId, setChatSessionId] = useState("");
  const [chatResult, setChatResult] = useState(null);
  const [widgetKeyResult, setWidgetKeyResult] = useState(null);
  const [widgetApiKeyInput, setWidgetApiKeyInput] = useState("");
  const [showWidgetPreview, setShowWidgetPreview] = useState(false);
  const [widgetPreviewOpen, setWidgetPreviewOpen] = useState(false);
  const [widgetDragOffset, setWidgetDragOffset] = useState({ x: 0, y: 0 });
  const [widgetDragging, setWidgetDragging] = useState(false);
  const widgetDraggingRef = useRef(false);
  const widgetDragStartRef = useRef({ pointerX: 0, pointerY: 0, offsetX: 0, offsetY: 0 });
  const [widgetTestMessage, setWidgetTestMessage] = useState("");
  const [widgetTestMessages, setWidgetTestMessages] = useState([
    { role: "assistant", content: "Hi, how can I help?" },
  ]);
  const [whatsappIntegration, setWhatsappIntegration] = useState(null);
  const [whatsappForm, setWhatsappForm] = useState(emptyWhatsAppForm);
  const [whatsappValidation, setWhatsappValidation] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState({
    health: false,
    companies: false,
    documents: false,
    upload: false,
    chat: false,
    widgetTest: false,
    whatsapp: false,
    conversations: false,
    auth: false,
    admins: false,
  });

  const selectedCompany = useMemo(
    () => companies.find((company) => company._id === selectedId) || null,
    [companies, selectedId]
  );
  const isSuperAdmin = currentUser?.role === "superadmin";
  const navItems = isSuperAdmin
    ? [
        { id: "dashboard", label: "Dashboard", icon: Activity },
        { id: "companies", label: "Company Management", icon: Building2 },
        { id: "admins", label: "Admin Management", icon: Users },
      ]
    : [
        { id: "dashboard", label: "Dashboard", icon: Activity },
        { id: "documents", label: "Document Management", icon: FileText },
        { id: "whatsapp", label: "WhatsApp Integration", icon: MessageSquare },
        { id: "history", label: "Chat History", icon: History },
        { id: "help", label: "Widget Help", icon: Search },
      ];
  const companyDashboardNav = [
    { id: "dashboard", label: "Company Dashboard", icon: Activity },
    { id: "documents", label: "Document Management", icon: FileText },
    { id: "whatsapp", label: "WhatsApp Integration", icon: MessageSquare },
    { id: "chat", label: "Chat Test", icon: MessageSquare },
    { id: "history", label: "Chat History", icon: History },
    { id: "help", label: "Widget Help", icon: Search },
  ];
  const activeNavItems = isSuperAdmin && selectedCompany ? companyDashboardNav : navItems;
  const adminGroups = useMemo(() => {
    const groups = new Map();
    for (const admin of adminUsers) {
      const key =
        admin.role === "superadmin"
          ? "Superadmins"
          : admin.companyId?.name || admin.companyId || "Unassigned company";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(admin);
    }
    return Array.from(groups.entries());
  }, [adminUsers]);
  const indexedDocumentCount = documents.filter((document) => document.status === "indexed").length;
  const failedDocumentCount = documents.filter((document) => document.status === "failed").length;
  const totalDocumentChunks = documents.reduce(
    (total, document) => total + (Number(document.chunksIndexed) || 0),
    0
  );
  const selectedConversationMessageCount = selectedConversation?.messages?.length || 0;

  async function runTask(key, task, successMessage = "") {
    console.log("[task] start", key);
    setLoading((current) => ({ ...current, [key]: true }));
    setError("");
    setNotice("");
    try {
      const result = await task();
      console.log("[task] success", key, result);
      if (successMessage) setNotice(successMessage);
      return result;
    } catch (err) {
      console.error("[task] error", key, err);
      setError(err.message || "Something went wrong");
      return null;
    } finally {
      console.log("[task] finish", key);
      setLoading((current) => ({ ...current, [key]: false }));
    }
  }

  async function loadHealth() {
    const result = await runTask("health", () => api.health());
    if (result) setHealth(result);
  }

  async function loadCompanies() {
    const result = await runTask("companies", () => api.companies.list());
    if (result) {
      setCompanies(result);
      if (currentUser?.role === "company_admin" && currentUser.companyId) {
        setSelectedId(String(currentUser.companyId));
      } else if (!isSuperAdmin && !selectedId && result[0]) setSelectedId(result[0]._id);
      if (selectedId && !result.some((company) => company._id === selectedId)) {
        setSelectedId(result[0]?._id || "");
      }
    }
  }

  async function loadDocuments(companyId = selectedId) {
    if (!companyId) {
      setDocuments([]);
      return;
    }
    const result = await runTask("documents", () => api.documents.list(companyId));
    if (result) setDocuments(result);
  }

  async function loadConversations(companyId = selectedId) {
    if (!companyId) {
      setConversations([]);
      return;
    }
    const result = await runTask("conversations", () => api.chat.conversations(companyId));
    if (result) setConversations(result);
  }

  async function loadWhatsAppIntegration(companyId = selectedId) {
    if (!companyId) {
      setWhatsappIntegration(null);
      setWhatsappForm(emptyWhatsAppForm);
      setWhatsappValidation(null);
      return;
    }

    setLoading((current) => ({ ...current, whatsapp: true }));
    setWhatsappValidation(null);
    try {
      const result = await api.whatsappIntegration.get(companyId);
      const integration = Array.isArray(result) ? null : result;
      setWhatsappIntegration(integration);
      setWhatsappForm({
        phoneNumberId: integration?.phoneNumberId || "",
        accessToken: "",
        isActive: integration?.isActive !== false,
      });
    } catch (err) {
      if (String(err.message || "").toLowerCase().includes("not found")) {
        setWhatsappIntegration(null);
        setWhatsappForm(emptyWhatsAppForm);
      } else {
        setError(err.message || "Failed to load WhatsApp integration");
      }
    } finally {
      setLoading((current) => ({ ...current, whatsapp: false }));
    }
  }

  async function loadAdminUsers() {
    if (!isSuperAdmin) return;
    const result = await runTask("admins", () => api.adminUsers.list());
    if (result) setAdminUsers(result);
  }

  const handleWidgetDragMove = useCallback((event) => {
    if (!widgetDraggingRef.current) return;
    const dx = event.clientX - widgetDragStartRef.current.pointerX;
    const dy = event.clientY - widgetDragStartRef.current.pointerY;
    setWidgetDragOffset({
      x: widgetDragStartRef.current.offsetX + dx,
      y: widgetDragStartRef.current.offsetY + dy,
    });
  }, []);

  const handleWidgetDragEnd = useCallback(() => {
    widgetDraggingRef.current = false;
    setWidgetDragging(false);
    window.removeEventListener("pointermove", handleWidgetDragMove);
    window.removeEventListener("pointerup", handleWidgetDragEnd);
  }, [handleWidgetDragMove]);

  const handleWidgetDragStart = useCallback(
    (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("button")) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      widgetDraggingRef.current = true;
      setWidgetDragging(true);
      widgetDragStartRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        offsetX: widgetDragOffset.x,
        offsetY: widgetDragOffset.y,
      };
      window.addEventListener("pointermove", handleWidgetDragMove);
      window.addEventListener("pointerup", handleWidgetDragEnd);
    },
    [handleWidgetDragEnd, handleWidgetDragMove, widgetDragOffset]
  );

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handleWidgetDragMove);
      window.removeEventListener("pointerup", handleWidgetDragEnd);
    };
  }, [handleWidgetDragEnd, handleWidgetDragMove]);

  useEffect(() => {
    loadHealth();
    async function restoreSession() {
      if (!getAuthToken()) {
        setAuthChecked(true);
        return;
      }
      const user = await runTask("auth", () => api.auth.me());
      if (user) setCurrentUser(user);
      else setAuthToken("");
      setAuthChecked(true);
    }
    restoreSession();
  }, []);

  useEffect(() => {
    if (currentUser) {
      setActiveSection("dashboard");
      loadCompanies();
      loadAdminUsers();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedId) {
      loadDocuments(selectedId);
      loadConversations(selectedId);
      loadWhatsAppIntegration(selectedId);
      setSelectedConversation(null);
      setChatResult(null);
      setWidgetKeyResult(null);
      setWidgetApiKeyInput("");
      setShowWidgetPreview(false);
      setWidgetPreviewOpen(false);
    }
  }, [selectedId]);

  async function handleLogin(event) {
    event.preventDefault();
    console.log("[login] submit clicked", {
      email: loginForm.email,
      passwordLength: loginForm.password.length,
      apiBaseUrl: api.baseUrl,
    });
    const result = await runTask("auth", () => api.auth.login(loginForm), "Signed in");
    console.log("[login] result", result);
    if (result) {
      setAuthToken(result.token);
      console.log("[login] token saved, user set", result.user);
      setCurrentUser(result.user);
      setSelectedId(result.user.role === "company_admin" ? String(result.user.companyId) : "");
    }
  }

  function handleLogout() {
    setAuthToken("");
    setCurrentUser(null);
    setCompanies([]);
    setSelectedId("");
    setDocuments([]);
    setConversations([]);
    setSelectedConversation(null);
    setWidgetKeyResult(null);
    setWidgetApiKeyInput("");
    setShowWidgetPreview(false);
    setWidgetPreviewOpen(false);
    setWhatsappIntegration(null);
    setWhatsappForm(emptyWhatsAppForm);
    setWhatsappValidation(null);
  }

  useEffect(() => {
    if (selectedCompany && editingCompany) {
      setCompanyForm({
        name: selectedCompany.name || "",
        slug: selectedCompany.slug || "",
        description: selectedCompany.description || "",
      });
    }
  }, [selectedCompany, editingCompany]);

  async function handleCreateCompany(event) {
    event.preventDefault();
    if (!isSuperAdmin) return;
    const payload = {
      name: companyForm.name.trim(),
      description: companyForm.description.trim(),
    };
    if (companyForm.slug.trim()) payload.slug = companyForm.slug.trim();

    const created = await runTask(
      "companies",
      () => api.companies.create(payload),
      "Company created"
    );
    if (created) {
      setCompanyForm(emptyCompanyForm);
      setShowCompanyModal(false);
      await loadCompanies();
    }
  }

  async function handleUpdateCompany(event) {
    event.preventDefault();
    if (!selectedCompany) return;
    const updated = await runTask(
      "companies",
      () =>
        api.companies.update(selectedCompany._id, {
          name: companyForm.name.trim(),
          description: companyForm.description.trim(),
          isActive: selectedCompany.isActive,
        }),
      "Company updated"
    );
    if (updated) {
      setEditingCompany(false);
      await loadCompanies();
    }
  }

  async function handleToggleCompany() {
    if (!selectedCompany) return;
    const updated = await runTask(
      "companies",
      () =>
        api.companies.update(selectedCompany._id, {
          name: selectedCompany.name,
          description: selectedCompany.description,
          isActive: !selectedCompany.isActive,
        }),
      "Company status updated"
    );
    if (updated) await loadCompanies();
  }

  async function handleDeleteCompany() {
    if (!selectedCompany) return;
    if (!isSuperAdmin) return;
    const ok = window.confirm(`Delete ${selectedCompany.name}?`);
    if (!ok) return;
    const result = await runTask(
      "companies",
      () => api.companies.remove(selectedCompany._id),
      "Company deleted"
    );
    if (result) {
      setSelectedId("");
      await loadCompanies();
    }
  }

  function openCompanyDashboard(companyId) {
    setSelectedId(companyId);
    setActiveSection("dashboard");
  }

  function backToSuperAdmin() {
    setSelectedId("");
    setActiveSection("dashboard");
    setDocuments([]);
    setConversations([]);
    setSelectedConversation(null);
    setChatResult(null);
    setWidgetKeyResult(null);
    setWidgetApiKeyInput("");
    setShowWidgetPreview(false);
    setWidgetPreviewOpen(false);
    setWhatsappIntegration(null);
    setWhatsappForm(emptyWhatsAppForm);
    setWhatsappValidation(null);
  }

  async function handleGenerateWidgetApiKey() {
    if (!selectedCompany) return;
    const result = await runTask(
      "companies",
      () => api.companies.generateWidgetApiKey(selectedCompany._id),
      "Widget API key generated"
    );
    if (result) {
      setWidgetKeyResult(result);
      setWidgetApiKeyInput(result.apiKey);
      await loadCompanies();
    }
  }

  async function copyWidgetSnippet() {
    if (!selectedCompany) return;
    const snippet = widgetSnippet();
    await navigator.clipboard.writeText(snippet);
    setNotice("Widget embed code copied");
  }

  async function copyWidgetKey() {
    const key = widgetKeyResult?.apiKey || widgetApiKeyInput.trim();
    if (!key) return;
    await navigator.clipboard.writeText(key);
    setNotice("Widget API key copied");
  }

  function widgetSnippet() {
    if (!selectedCompany) return "";
    return `<script>
  window.RAG_CHAT_WIDGET = {
    apiBaseUrl: "http://localhost:3000",
    companyId: "${selectedCompany._id}",
    apiKey: "${widgetApiKeyInput.trim() || "PASTE_WIDGET_API_KEY"}",
    title: "${selectedCompany.name} Support",
    subtitle: "Ask us anything",
    accentColor: "#111827",
    position: "right"
  };
</script>
<script src="http://localhost:5173/dist-widget/rag-chat-widget.iife.js"></script>`;
  }

  async function handleWidgetTestChat(event) {
    event.preventDefault();
    if (!selectedCompany || !widgetApiKeyInput.trim() || !widgetTestMessage.trim()) return;
    const message = widgetTestMessage.trim();
    setWidgetTestMessage("");
    setWidgetTestMessages((current) => [...current, { role: "user", content: message }]);

    const result = await runTask("widgetTest", async () => {
      const response = await fetch(`${api.baseUrl}/widget/companies/${selectedCompany._id}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Widget-API-Key": widgetApiKeyInput.trim(),
        },
        body: JSON.stringify({
          message,
          sessionId: `dashboard_widget_test_${selectedCompany._id}`,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Widget chat failed");
      return data;
    });

    if (result) {
      setWidgetTestMessages((current) => [
        ...current,
        { role: "assistant", content: result.answer, sources: result.sources || [] },
      ]);
    }
  }

  async function handleSaveWhatsAppIntegration(event) {
    event.preventDefault();
    if (!selectedCompany) return;

    const phoneNumberId = whatsappForm.phoneNumberId.trim();
    const accessToken = whatsappForm.accessToken.trim();

    if (!phoneNumberId) {
      setError("WhatsApp phone number ID is required");
      return;
    }

    if (!whatsappIntegration && !accessToken) {
      setError("Access token is required when creating a WhatsApp integration");
      return;
    }

    const payload = {
      phoneNumberId,
      isActive: whatsappForm.isActive,
    };
    if (accessToken) payload.accessToken = accessToken;

    const result = await runTask(
      "whatsapp",
      () => api.whatsappIntegration.save(selectedCompany._id, payload, Boolean(whatsappIntegration)),
      whatsappIntegration ? "WhatsApp integration updated" : "WhatsApp integration saved"
    );

    if (result) {
      setWhatsappIntegration(result);
      setWhatsappForm({
        phoneNumberId: result.phoneNumberId || phoneNumberId,
        accessToken: "",
        isActive: result.isActive !== false,
      });
      setWhatsappValidation(null);
    }
  }

  async function handleValidateWhatsAppIntegration() {
    if (!selectedCompany) return;

    const result = await runTask(
      "whatsapp",
      () => api.whatsappIntegration.validate(selectedCompany._id),
      "WhatsApp integration validated"
    );

    if (result) setWhatsappValidation(result);
  }

  async function handleDeleteWhatsAppIntegration() {
    if (!selectedCompany || !whatsappIntegration) return;
    const ok = window.confirm("Delete this WhatsApp integration?");
    if (!ok) return;

    const result = await runTask(
      "whatsapp",
      () => api.whatsappIntegration.remove(selectedCompany._id),
      "WhatsApp integration deleted"
    );

    if (result) {
      setWhatsappIntegration(null);
      setWhatsappForm(emptyWhatsAppForm);
      setWhatsappValidation(null);
    }
  }

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedCompany) return;
    const result = await runTask(
      "upload",
      () => api.documents.upload(selectedCompany._id, file),
      "Document uploaded and indexed"
    );
    if (result) await loadDocuments();
  }

  async function handleReindex(documentId) {
    const result = await runTask(
      "documents",
      () => api.documents.reindex(selectedCompany._id, documentId),
      "Document reindexed"
    );
    if (result) await loadDocuments();
  }

  async function handleDeleteDocument(documentId) {
    const ok = window.confirm("Delete this document and vectors?");
    if (!ok) return;
    const result = await runTask(
      "documents",
      () => api.documents.remove(selectedCompany._id, documentId),
      "Document deleted"
    );
    if (result) await loadDocuments();
  }

  async function handleChat(event) {
    event.preventDefault();
    if (!selectedCompany || !chatMessage.trim()) return;
    const payload = { message: chatMessage.trim() };
    if (chatSessionId.trim()) payload.sessionId = chatSessionId.trim();
    const result = await runTask("chat", () => api.chat.ask(selectedCompany._id, payload));
    if (result) {
      setChatResult(result);
      setChatSessionId(result.sessionId || "");
      setChatMessage("");
      await loadConversations();
    }
  }

  async function handleOpenConversation(sessionId) {
    if (!selectedCompany) return;
    const result = await runTask("conversations", () =>
      api.chat.history(selectedCompany._id, sessionId)
    );
    if (result) setSelectedConversation(result);
  }

  async function handleCreateAdmin(event) {
    event.preventDefault();
    const payload = {
      name: adminForm.name.trim(),
      email: adminForm.email.trim(),
      password: adminForm.password,
      role: adminForm.role,
      companyId: adminForm.role === "company_admin" ? adminForm.companyId : null,
    };
    const result = await runTask("admins", () => api.adminUsers.create(payload), "Admin user created");
    if (result) {
      setAdminForm(emptyAdminForm);
      await loadAdminUsers();
    }
  }

  async function handleToggleAdmin(admin) {
    const result = await runTask(
      "admins",
      () => api.adminUsers.update(admin._id, { isActive: !admin.isActive }),
      "Admin status updated"
    );
    if (result) await loadAdminUsers();
  }

  async function handleDeleteAdmin(admin) {
    const ok = window.confirm(`Delete admin ${admin.email}?`);
    if (!ok) return;
    const result = await runTask("admins", () => api.adminUsers.remove(admin._id), "Admin user deleted");
    if (result) await loadAdminUsers();
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] text-slate-600">
        <Loader2 className="mr-2 animate-spin" size={18} />
        Loading
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-4">
        <section className="w-full max-w-md rounded border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded bg-slate-900 text-white">
              <MessageSquare size={21} />
            </div>
            <h1 className="text-2xl font-bold text-slate-950">Admin Login</h1>
            <p className="mt-1 text-sm text-slate-500">{api.baseUrl}</p>
          </div>
          {error && (
            <div className="mb-4 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          <form className="space-y-4" onSubmit={handleLogin}>
            <Field label="Email">
              <TextInput
                type="email"
                value={loginForm.email}
                onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </Field>
            <Field label="Password">
              <TextInput
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                required
              />
            </Field>
            <PrimaryButton type="submit" className="w-full" disabled={loading.auth}>
              {loading.auth ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              Sign in
            </PrimaryButton>
          </form>
          <p className="mt-4 text-xs text-slate-500">
            Default superadmin: admin@example.com / admin123
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 shadow-sm shadow-slate-200/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 text-white shadow-lg shadow-slate-300">
              <MessageSquare size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-950">RAG System Admin</h1>
              <p className="text-sm text-slate-500">{api.baseUrl}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-10 items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm shadow-slate-200/60">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                <Users size={16} />
              </span>
              <span className="leading-tight">
                <span className="block text-slate-900">{currentUser.name}</span>
                <span className="block text-xs font-medium text-slate-500">{currentUser.role}</span>
              </span>
            </span>
            {health && (
              <>
                <StatusBadge status={health.mongodb} />
                <StatusBadge status={health.ragService} />
              </>
            )}
            <SecondaryButton onClick={loadHealth} disabled={loading.health}>
              {loading.health ? <Loader2 className="animate-spin" size={16} /> : <Activity size={16} />}
              System Check
            </SecondaryButton>
            <SecondaryButton onClick={handleLogout}>
              <LogOut size={16} />
              Logout
            </SecondaryButton>
          </div>
        </div>
      </header>

      {showCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <section className="w-full max-w-lg rounded border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <Plus size={18} />
                <h2 className="font-semibold text-slate-950">Add Company</h2>
              </div>
              <IconButton title="Close" onClick={() => setShowCompanyModal(false)}>
                <XCircle size={16} />
              </IconButton>
            </div>
            <form className="space-y-3 p-4" onSubmit={handleCreateCompany}>
              <Field label="Name">
                <TextInput
                  value={companyForm.name}
                  onChange={(event) =>
                    setCompanyForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Acme Support"
                  required
                />
              </Field>
              <Field label="Slug optional">
                <TextInput
                  value={companyForm.slug}
                  onChange={(event) =>
                    setCompanyForm((current) => ({ ...current, slug: event.target.value }))
                  }
                  placeholder="acme-support"
                />
              </Field>
              <Field label="Description">
                <TextArea
                  value={companyForm.description}
                  onChange={(event) =>
                    setCompanyForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Customer support knowledge base"
                />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <SecondaryButton onClick={() => setShowCompanyModal(false)}>Cancel</SecondaryButton>
                <PrimaryButton type="submit" disabled={loading.companies}>
                  {loading.companies ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                  Create
                </PrimaryButton>
              </div>
            </form>
          </section>
        </div>
      )}

      {showWidgetPreview && selectedCompany && widgetApiKeyInput.trim() && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
          <section className="flex h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} />
                <div>
                  <h2 className="font-semibold text-slate-950">Test Website Widget</h2>
                  <p className="text-xs text-slate-500">This is how the chatbot opens on a customer website.</p>
                </div>
              </div>
              <IconButton title="Close" onClick={() => setShowWidgetPreview(false)}>
                <XCircle size={16} />
              </IconButton>
            </div>
            <div className="relative min-h-0 flex-1 bg-slate-100 p-6">
              <div className="min-h-[360px] rounded border border-slate-200 bg-white p-6 shadow-sm">
                <h1 className="text-2xl font-bold text-slate-950">{selectedCompany.name}</h1>
                <p className="mt-2 text-sm text-slate-500">
                  Example customer website page. Click the floating chat button in the bottom-right corner.
                </p>
                <div className="mt-8 grid gap-3 md:grid-cols-2">
                  <div className="rounded border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">Knowledge support</div>
                    <p className="mt-1 text-sm text-slate-500">Ask questions from uploaded documents.</p>
                  </div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">Website embed</div>
                    <p className="mt-1 text-sm text-slate-500">This preview uses the public widget API key.</p>
                  </div>
                </div>
              </div>
              {widgetPreviewOpen && (
              <div
                className="absolute flex h-[520px] w-[380px] max-w-[calc(100%-48px)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-950/25"
                style={{ right: 100 - widgetDragOffset.x, bottom: 50 - widgetDragOffset.y }}
              >
                <div
                  className={classNames(
                    "bg-slate-950 px-4 py-3 text-white",
                    widgetDragging ? "cursor-grabbing" : "cursor-grab"
                  )}
                  onPointerDown={handleWidgetDragStart}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/10">
                        <MessageSquare size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold">{selectedCompany.name} Support</div>
                        <div className="mt-0.5 text-[11px] text-slate-300">Widget test mode</div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                        title="More options"
                        aria-label="More options"
                      >
                        <MoreVertical size={18} />
                      </button>
                    <button
                      type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                        title="Close chat"
                        aria-label="Close chat"
                      onClick={() => setWidgetPreviewOpen(false)}
                    >
                        <X size={18} />
                    </button>
                    </div>
                  </div>
                </div>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white p-4">
                  {widgetTestMessages.map((message, index) => (
                    <div key={`${message.role}-${index}`} className={classNames("flex gap-3", message.role === "user" && "justify-end")}>
                      {message.role !== "user" && (
                        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white shadow-sm">
                          <MessageSquare size={17} />
                        </div>
                      )}
                      <div className={classNames("max-w-[78%]", message.role === "user" && "ml-auto")}>
                        <div
                          className={classNames(
                            "rounded-lg px-4 py-3 text-sm leading-6 shadow-sm",
                            message.role === "user"
                              ? "bg-slate-950 text-white"
                              : "border border-slate-200 bg-white text-slate-800 shadow-slate-200/70"
                          )}
                        >
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          {message.sources?.length > 0 && (
                            <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-500">
                              Sources: {message.sources.map((source) => source.documentName).filter(Boolean).join(", ")}
                            </div>
                          )}
                        </div>
                        <div className={classNames("mt-2 text-xs text-slate-400", message.role === "user" && "text-right")}>
                          {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <form className="flex gap-2 border-t border-slate-200 bg-white p-4" onSubmit={handleWidgetTestChat}>
                  <div className="relative min-w-0 flex-1">
                    <input
                      className="h-11 w-full rounded-md border border-slate-200 bg-white px-4 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                      value={widgetTestMessage}
                      onChange={(event) => setWidgetTestMessage(event.target.value)}
                      placeholder="Type test message"
                    />
                    <Smile className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
                  </div>
                  <button
                    type="submit"
                    className="h-11 rounded-md bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm shadow-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={loading.widgetTest}
                  >
                    {loading.widgetTest ? "..." : "Send"}
                  </button>
                </form>
              </div>
              )}
              <button
                type="button"
                onClick={() => setWidgetPreviewOpen((value) => !value)}
                className="absolute bottom-6 right-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-white shadow-2xl transition hover:bg-slate-800"
                title="Open chat"
                aria-label="Open chat"
              >
                <MessageSquare size={25} />
              </button>
            </div>
          </section>
        </div>
      )}

      <main className="mx-auto grid w-full max-w-[1800px] grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-6">
        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm shadow-slate-200/70">
            <div className="px-2 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Navigation
            </div>
            <nav className="space-y-1">
              {isSuperAdmin && selectedCompany && (
                <button
                  type="button"
                  onClick={backToSuperAdmin}
                  className="mb-2 flex w-full items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-3 text-left text-sm font-semibold text-slate-700 shadow-sm shadow-slate-200/60 transition hover:bg-slate-50"
                >
                  <Building2 size={17} />
                  Superadmin Home
                </button>
              )}
              {activeNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    className={classNames(
                      "flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-semibold transition",
                      activeSection === item.id
                        ? "bg-slate-900 text-white shadow-md shadow-slate-300"
                        : "text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <Icon size={17} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </section>

          {false && isSuperAdmin && !selectedCompany && activeSection === "companies" && (
          <section className="rounded border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <Building2 size={18} />
                <h2 className="font-semibold text-slate-950">Companies</h2>
              </div>
              <IconButton title="Refresh companies" onClick={loadCompanies}>
                <RefreshCcw size={16} />
              </IconButton>
            </div>
            <div className="max-h-[360px] overflow-y-auto p-2 scrollbar-thin">
              {companies.length === 0 ? (
                <p className="px-2 py-6 text-sm text-slate-500">No companies yet.</p>
              ) : (
                companies.map((company) => (
                  <button
                    type="button"
                    key={company._id}
                    onClick={() => openCompanyDashboard(company._id)}
                    className={classNames(
                      "mb-1 w-full rounded px-3 py-3 text-left transition",
                      selectedId === company._id
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold">{company.name}</span>
                      {company.isActive ? (
                        <CheckCircle2 className="mt-0.5 shrink-0" size={15} />
                      ) : (
                        <XCircle className="mt-0.5 shrink-0" size={15} />
                      )}
                    </div>
                    <div
                      className={classNames(
                        "mt-1 truncate text-xs",
                        selectedId === company._id ? "text-slate-300" : "text-slate-500"
                      )}
                    >
                      {company.slug}
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>
          )}

        </aside>

        <section className="space-y-4">
          {(notice || error) && (
            <div
              className={classNames(
                "rounded border px-4 py-3 text-sm",
                error
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              )}
            >
              {error || notice}
            </div>
          )}

          {isSuperAdmin && !selectedCompany && activeSection !== "admins" ? (
            <>
              {activeSection === "dashboard" && (
                <section className="grid gap-5 md:grid-cols-3">
                  <StatCard
                    icon={Building2}
                    label="Companies"
                    value={companies.length}
                    detail="Total companies"
                    tint="bg-slate-100 text-slate-700"
                  />
                  <StatCard
                    icon={Users}
                    label="Admins"
                    value={adminUsers.length}
                    detail="Total admin users"
                    tint="bg-slate-100 text-slate-700"
                  />
                  <StatCard
                    icon={Power}
                    label="Backend"
                    value={health?.mongodb === "ok" ? "Active" : "Check"}
                    detail="Database status"
                    tint="bg-emerald-50 text-emerald-600"
                  />
                </section>
              )}
              {activeSection === "dashboard" && (
                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Building2 size={18} />
                      <h2 className="font-semibold text-slate-950">Companies</h2>
                    </div>
                    <SecondaryButton onClick={() => setActiveSection("companies")}>
                      <Plus size={16} />
                      Manage
                    </SecondaryButton>
                  </div>
                  <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                    {companies.map((company) => (
                      <button
                        type="button"
                        key={company._id}
                        onClick={() => openCompanyDashboard(company._id)}
                        className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm shadow-slate-200/50 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-950">{company.name}</div>
                            <div className="mt-1 text-sm text-slate-500">{company.slug}</div>
                          </div>
                          <StatusBadge status={company.isActive ? "active" : "inactive"} />
                        </div>
                        <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                          {company.description || "No description"}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {activeSection === "companies" && (
                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
                  <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 size={18} />
                      <h2 className="font-semibold text-slate-950">Company Management</h2>
                    </div>
                    <div className="flex gap-2">
                      <IconButton title="Refresh companies" onClick={loadCompanies}>
                        <RefreshCcw size={16} />
                      </IconButton>
                      <PrimaryButton onClick={() => setShowCompanyModal(true)}>
                        <Plus size={16} />
                        Add Company
                      </PrimaryButton>
                    </div>
                  </div>
                  <div className="overflow-x-auto p-2">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Company</th>
                          <th className="px-4 py-3">Slug</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Created</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {companies.map((company) => (
                          <tr key={company._id} className="transition hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900">{company.name}</div>
                              <div className="max-w-md truncate text-xs text-slate-500">
                                {company.description || "No description"}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{company.slug}</td>
                            <td className="px-4 py-3">
                              <StatusBadge status={company.isActive ? "active" : "inactive"} />
                            </td>
                            <td className="px-4 py-3 text-slate-600">{formatDate(company.createdAt)}</td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end">
                                <SecondaryButton onClick={() => openCompanyDashboard(company._id)}>
                                  Open
                                </SecondaryButton>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          ) : !selectedCompany && !(isSuperAdmin && activeSection === "admins") ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm shadow-slate-200/70">
              <Building2 className="mx-auto mb-3 text-slate-400" size={34} />
              <h2 className="text-lg font-semibold text-slate-950">Select or create a company</h2>
            </div>
          ) : (
            <>
              {activeSection === "dashboard" && (
                <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  <StatCard
                    icon={Building2}
                    label="Companies"
                    value={isSuperAdmin ? companies.length : 1}
                    detail="Total companies"
                    tint="bg-slate-100 text-slate-700"
                  />
                  <StatCard
                    icon={FileText}
                    label="Documents"
                    value={documents.length}
                    detail="Total documents"
                    tint="bg-slate-100 text-slate-700"
                  />
                  <StatCard
                    icon={MessageSquare}
                    label="Conversations"
                    value={conversations.length}
                    detail="Total conversations"
                    tint="bg-slate-100 text-slate-700"
                  />
                </section>
              )}

              {(activeSection === "dashboard" || activeSection === "companies") && (
              <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
                <div className="h-1 bg-slate-900" />
                <div className="p-5">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                          <Building2 size={22} />
                        </div>
                        <div className="min-w-0">
                          <h2 className="truncate text-2xl font-bold text-slate-950">{selectedCompany.name}</h2>
                          <p className="mt-1 text-sm text-slate-500">{selectedCompany.description || "No description"}</p>
                        </div>
                        <StatusBadge status={selectedCompany.isActive ? "active" : "inactive"} />
                      </div>
                      <p className="mt-3 break-all pl-0 text-xs text-slate-400 sm:pl-14">ID: {selectedCompany._id}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 self-start">
                      <SecondaryButton onClick={() => setEditingCompany((value) => !value)}>
                        <Pencil size={16} />
                        Edit
                      </SecondaryButton>
                      <SecondaryButton onClick={handleToggleCompany}>
                        {selectedCompany.isActive ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                        {selectedCompany.isActive ? "Disable" : "Enable"}
                      </SecondaryButton>
                      {isSuperAdmin && (
                      <SecondaryButton
                        className="text-rose-700 hover:bg-rose-50"
                        onClick={handleDeleteCompany}
                      >
                        <Trash2 size={16} />
                        Delete
                      </SecondaryButton>
                      )}
                    </div>
                  </div>
                  <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-inner shadow-slate-100">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                          <KeyRound size={18} />
                        </div>
                        <div>
                          <div className="text-base font-semibold text-slate-900">Widget API Key</div>
                          <div className="mt-1 text-xs text-slate-500">
                            Current key: {selectedCompany.widgetApiKeyPreview || "Not generated"}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <SecondaryButton onClick={handleGenerateWidgetApiKey}>
                          <RefreshCcw size={16} />
                          Generate / Rotate
                        </SecondaryButton>
                        <SecondaryButton onClick={copyWidgetSnippet}>
                          <Code2 size={16} />
                          Copy Embed
                        </SecondaryButton>
                        <SecondaryButton
                          onClick={() => {
                            setWidgetPreviewOpen(false);
                            setShowWidgetPreview(true);
                          }}
                          disabled={!widgetApiKeyInput.trim()}
                        >
                          <ExternalLink size={16} />
                          Test Widget
                        </SecondaryButton>
                      </div>
                    {widgetKeyResult?.apiKey && (
                      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                              Copy this key now
                            </div>
                            <code className="mt-2 block break-all text-xs text-amber-900">
                              {widgetKeyResult.apiKey}
                            </code>
                          </div>
                          <IconButton title="Copy widget API key" onClick={copyWidgetKey}>
                            <Clipboard size={16} />
                          </IconButton>
                        </div>
                      </div>
                    )}
                    <div className="mt-4">
                      <Field label="Widget API key for test/embed">
                        <div className="flex gap-2">
                          <TextInput
                            value={widgetApiKeyInput}
                            onChange={(event) => setWidgetApiKeyInput(event.target.value)}
                            placeholder="Paste generated widget API key here"
                          />
                          <IconButton title="Copy widget API key" onClick={copyWidgetKey} disabled={!widgetApiKeyInput.trim()}>
                            <Clipboard size={16} />
                          </IconButton>
                        </div>
                      </Field>
                      <p className="mt-1 text-xs text-slate-500">
                        The full key is shown only once after generation. Paste it here anytime to test or copy embed code.
                      </p>
                    </div>
                  </div>
                </div>

                  {editingCompany && (
                    <form className="mt-4 grid gap-3 border-t border-slate-200 pt-4 lg:grid-cols-2" onSubmit={handleUpdateCompany}>
                      <Field label="Name">
                        <TextInput
                          value={companyForm.name}
                          onChange={(event) =>
                            setCompanyForm((current) => ({ ...current, name: event.target.value }))
                          }
                        />
                      </Field>
                      <Field label="Slug">
                        <TextInput value={companyForm.slug} disabled />
                      </Field>
                      <div className="lg:col-span-2">
                        <Field label="Description">
                          <TextArea
                            value={companyForm.description}
                            onChange={(event) =>
                              setCompanyForm((current) => ({
                                ...current,
                                description: event.target.value,
                              }))
                            }
                          />
                        </Field>
                      </div>
                      <div className="flex gap-2 lg:col-span-2">
                        <PrimaryButton type="submit" disabled={loading.companies}>
                          <CheckCircle2 size={16} />
                          Save
                        </PrimaryButton>
                        <SecondaryButton onClick={() => setEditingCompany(false)}>Cancel</SecondaryButton>
                      </div>
                    </form>
                  )}
                  </div>
              </section>
              )}

              {activeSection === "whatsapp" && (
                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
                  <div className="h-1 bg-slate-900" />
                  <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                        <MessageSquare size={20} />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-slate-950">WhatsApp Integration</h2>
                          {whatsappIntegration && (
                            <StatusBadge status={whatsappIntegration.isActive ? "active" : "inactive"} />
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Manage the Meta Cloud API connection for this company.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <IconButton title="Refresh WhatsApp integration" onClick={() => loadWhatsAppIntegration()}>
                        <RefreshCcw size={16} />
                      </IconButton>
                      <SecondaryButton
                        onClick={handleValidateWhatsAppIntegration}
                        disabled={!whatsappIntegration || loading.whatsapp}
                      >
                        {loading.whatsapp ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                        Validate
                      </SecondaryButton>
                      {whatsappIntegration && (
                        <SecondaryButton
                          className="text-rose-700 hover:bg-rose-50"
                          onClick={handleDeleteWhatsAppIntegration}
                          disabled={loading.whatsapp}
                        >
                          <Trash2 size={16} />
                          Delete
                        </SecondaryButton>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                    <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-3">
                      <MiniMetric
                        icon={MessageSquare}
                        label="Integration"
                        value={whatsappIntegration ? "Configured" : "Not set"}
                      />
                      <MiniMetric
                        icon={CheckCircle2}
                        label="Status"
                        value={whatsappForm.isActive ? "Active" : "Inactive"}
                      />
                      <MiniMetric
                        icon={History}
                        label="Updated"
                        value={formatDate(whatsappIntegration?.updatedAt) || "-"}
                      />
                    </div>
                    <form className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-inner shadow-slate-100" onSubmit={handleSaveWhatsAppIntegration}>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="WhatsApp phone number ID">
                          <TextInput
                            value={whatsappForm.phoneNumberId}
                            onChange={(event) =>
                              setWhatsappForm((current) => ({
                                ...current,
                                phoneNumberId: event.target.value,
                              }))
                            }
                            placeholder="1175322778994139"
                            required
                          />
                        </Field>
                        <Field label="Status">
                          <label className="flex h-10 items-center gap-3 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300"
                              checked={whatsappForm.isActive}
                              onChange={(event) =>
                                setWhatsappForm((current) => ({
                                  ...current,
                                  isActive: event.target.checked,
                                }))
                              }
                            />
                            Active for this company
                          </label>
                        </Field>
                      </div>
                      <Field label={whatsappIntegration ? "New access token optional" : "Access token"}>
                        <TextArea
                          value={whatsappForm.accessToken}
                          onChange={(event) =>
                            setWhatsappForm((current) => ({
                              ...current,
                              accessToken: event.target.value,
                            }))
                          }
                          placeholder={
                            whatsappIntegration
                              ? "Paste a new Meta access token only when rotating"
                              : "Paste Meta WhatsApp Cloud API access token"
                          }
                          required={!whatsappIntegration}
                        />
                      </Field>
                      <div className="flex flex-wrap gap-2">
                        <PrimaryButton type="submit" disabled={loading.whatsapp}>
                          {loading.whatsapp ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                          {whatsappIntegration ? "Update Integration" : "Save Integration"}
                        </PrimaryButton>
                        <SecondaryButton
                          onClick={() => {
                            setWhatsappForm({
                              phoneNumberId: whatsappIntegration?.phoneNumberId || "",
                              accessToken: "",
                              isActive: whatsappIntegration?.isActive !== false,
                            });
                            setWhatsappValidation(null);
                          }}
                        >
                          Reset
                        </SecondaryButton>
                      </div>
                    </form>
                    </div>

                    <aside className="space-y-3">
                      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-inner shadow-slate-100">
                        <div className="text-sm font-semibold text-slate-900">Saved credential</div>
                        <dl className="mt-3 space-y-3 text-sm">
                          <div>
                            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Phone number ID
                            </dt>
                            <dd className="mt-1 break-all text-slate-800">
                              {whatsappIntegration?.phoneNumberId || "Not configured"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Token preview
                            </dt>
                            <dd className="mt-1 text-slate-800">
                              {whatsappIntegration?.accessTokenLast4
                                ? `Ends with ${whatsappIntegration.accessTokenLast4}`
                                : "Not saved"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Updated
                            </dt>
                            <dd className="mt-1 text-slate-800">
                              {formatDate(whatsappIntegration?.updatedAt)}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      {whatsappValidation && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                          <div className="font-semibold">Validation passed</div>
                          <div className="mt-2 text-xs leading-5">
                            {whatsappValidation.metaPhoneNumber?.display_phone_number ||
                              whatsappValidation.metaPhoneNumber?.id ||
                              whatsappValidation.phoneNumberId}
                          </div>
                          {whatsappValidation.metaPhoneNumber?.quality_rating && (
                            <div className="mt-1 text-xs">
                              Quality: {whatsappValidation.metaPhoneNumber.quality_rating}
                            </div>
                          )}
                        </div>
                      )}
                    </aside>
                  </div>
                </section>
              )}

              {isSuperAdmin && activeSection === "admins" && (
                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Building2 size={18} />
                      <h2 className="font-semibold text-slate-950">Admin Users</h2>
                    </div>
                    <IconButton title="Refresh admins" onClick={loadAdminUsers}>
                      <RefreshCcw size={16} />
                    </IconButton>
                  </div>
                  <div className="grid gap-5 p-5 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <form className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-inner shadow-slate-100" onSubmit={handleCreateAdmin}>
                      <Field label="Name">
                        <TextInput
                          value={adminForm.name}
                          onChange={(event) => setAdminForm((current) => ({ ...current, name: event.target.value }))}
                          required
                        />
                      </Field>
                      <Field label="Email">
                        <TextInput
                          type="email"
                          value={adminForm.email}
                          onChange={(event) => setAdminForm((current) => ({ ...current, email: event.target.value }))}
                          required
                        />
                      </Field>
                      <Field label="Password">
                        <TextInput
                          type="password"
                          value={adminForm.password}
                          onChange={(event) => setAdminForm((current) => ({ ...current, password: event.target.value }))}
                          required
                        />
                      </Field>
                      <Field label="Role">
                        <SelectInput
                          value={adminForm.role}
                          onChange={(event) =>
                            setAdminForm((current) => ({ ...current, role: event.target.value }))
                          }
                        >
                          <option value="company_admin">Company admin</option>
                          <option value="superadmin">Superadmin</option>
                        </SelectInput>
                      </Field>
                      {adminForm.role === "company_admin" && (
                        <Field label="Company">
                          <SelectInput
                            value={adminForm.companyId}
                            onChange={(event) =>
                              setAdminForm((current) => ({ ...current, companyId: event.target.value }))
                            }
                            required
                          >
                            <option value="">Select company</option>
                            {companies.map((company) => (
                              <option key={company._id} value={company._id}>
                                {company.name}
                              </option>
                            ))}
                          </SelectInput>
                        </Field>
                      )}
                      <PrimaryButton type="submit" className="w-full" disabled={loading.admins}>
                        <Plus size={16} />
                        Add Admin
                      </PrimaryButton>
                    </form>
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Admin</th>
                            <th className="px-4 py-3">Role</th>
                            <th className="px-4 py-3">Company</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {adminGroups.map(([groupName, admins]) => (
                            <Fragment key={groupName}>
                              <tr key={`${groupName}-group`} className="bg-slate-50">
                                <td className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500" colSpan={5}>
                                  {groupName}
                                </td>
                              </tr>
                              {admins.map((admin) => (
                                <tr key={admin._id} className="transition hover:bg-slate-50">
                                  <td className="px-4 py-3">
                                    <div className="font-semibold text-slate-900">{admin.name}</div>
                                    <div className="text-xs text-slate-500">{admin.email}</div>
                                  </td>
                                  <td className="px-4 py-3 text-slate-600">{admin.role}</td>
                                  <td className="px-4 py-3 text-slate-600">
                                    {admin.role === "superadmin"
                                      ? "All companies"
                                      : admin.companyId?.name || admin.companyId || "-"}
                                  </td>
                                  <td className="px-4 py-3">
                                    <StatusBadge status={admin.isActive ? "active" : "inactive"} />
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex justify-end gap-2">
                                      <IconButton title="Toggle admin" onClick={() => handleToggleAdmin(admin)}>
                                        {admin.isActive ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                                      </IconButton>
                                      <IconButton
                                        title="Delete admin"
                                        className="text-rose-700 hover:bg-rose-50"
                                        onClick={() => handleDeleteAdmin(admin)}
                                      >
                                        <Trash2 size={16} />
                                      </IconButton>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              )}

              {(activeSection === "documents" || activeSection === "chat") && (
              <div className="grid gap-4 xl:grid-cols-1">
                {activeSection === "documents" && (
                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
                  <div className="h-1 bg-slate-900" />
                  <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                        <FileText size={20} />
                      </div>
                      <div>
                        <h2 className="font-semibold text-slate-950">Document Management</h2>
                        <p className="mt-1 text-xs text-slate-500">
                          Upload, index, and refresh company knowledge sources.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <IconButton title="Refresh documents" onClick={() => loadDocuments()}>
                        <RefreshCcw size={16} />
                      </IconButton>
                      <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm shadow-slate-300/70 transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow">
                        <Upload size={16} />
                        Upload PDF
                        <input
                          type="file"
                          accept="application/pdf"
                          className="sr-only"
                          onChange={handleUpload}
                          disabled={loading.upload}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="grid gap-4 border-b border-slate-200 p-5 md:grid-cols-2 xl:grid-cols-4">
                    <MiniMetric icon={FileText} label="Documents" value={documents.length} />
                    <MiniMetric icon={CheckCircle2} label="Indexed" value={indexedDocumentCount} />
                    <MiniMetric icon={XCircle} label="Failed" value={failedDocumentCount} />
                    <MiniMetric icon={Search} label="Chunks" value={totalDocumentChunks} />
                  </div>
                  <div className="overflow-x-auto p-2">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">File</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Chunks</th>
                          <th className="px-4 py-3">Updated</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {documents.length === 0 ? (
                          <tr>
                            <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                              <div className="mx-auto flex max-w-sm flex-col items-center">
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                  <FileText size={22} />
                                </div>
                                <div className="font-semibold text-slate-800">No documents uploaded</div>
                                <div className="mt-1 text-sm text-slate-500">
                                  Upload a PDF to make it available for chat answers.
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          documents.map((document) => (
                            <tr key={document._id} className="transition hover:bg-slate-50">
                              <td className="max-w-[320px] px-4 py-3">
                                <div className="truncate font-medium text-slate-900">{document.originalName}</div>
                                {document.indexError && (
                                  <div className="mt-1 truncate text-xs text-rose-600">{document.indexError}</div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={document.status} />
                              </td>
                              <td className="px-4 py-3 text-slate-600">{document.chunksIndexed || 0}</td>
                              <td className="px-4 py-3 text-slate-600">{formatDate(document.updatedAt)}</td>
                              <td className="px-4 py-3">
                                <div className="flex justify-end gap-2">
                                  <IconButton title="Reindex" onClick={() => handleReindex(document._id)}>
                                    <RefreshCcw size={16} />
                                  </IconButton>
                                  <IconButton
                                    title="Delete document"
                                    className="text-rose-700 hover:bg-rose-50"
                                    onClick={() => handleDeleteDocument(document._id)}
                                  >
                                    <Trash2 size={16} />
                                  </IconButton>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
                )}

                {isSuperAdmin && activeSection === "chat" && (
                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
                  <div className="h-1 bg-slate-900" />
                  <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                        <MessageSquare size={20} />
                      </div>
                      <div>
                        <h2 className="font-semibold text-slate-950">Chat Test</h2>
                        <p className="mt-1 text-xs text-slate-500">
                          Send a controlled test question against this company's indexed content.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 border-b border-slate-200 p-5 md:grid-cols-3">
                    <MiniMetric icon={FileText} label="Documents" value={documents.length} />
                    <MiniMetric icon={History} label="Session" value={chatResult?.sessionId ? "Active" : "New"} />
                    <MiniMetric icon={Search} label="Sources" value={chatResult?.sources?.length || 0} />
                  </div>
                  <form className="space-y-3 p-5" onSubmit={handleChat}>
                    <Field label="Session ID optional">
                      <TextInput
                        value={chatSessionId}
                        onChange={(event) => setChatSessionId(event.target.value)}
                        placeholder="Leave empty for new session"
                      />
                    </Field>
                    <Field label="Message">
                      <TextArea
                        value={chatMessage}
                        onChange={(event) => setChatMessage(event.target.value)}
                        placeholder="Ask from uploaded documents"
                        required
                      />
                    </Field>
                    <PrimaryButton type="submit" className="w-full" disabled={loading.chat}>
                      {loading.chat ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                      Send
                    </PrimaryButton>
                  </form>
                  {chatResult && (
                    <div className="border-t border-slate-200 bg-slate-50/60 p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white">
                          <MessageSquare size={16} />
                        </div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Answer
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{chatResult.answer}</p>
                      <div className="mt-4 text-xs text-slate-500">Session: {chatResult.sessionId}</div>
                      <div className="mt-4 space-y-2">
                        {(chatResult.sources || []).map((source, index) => (
                          <div key={`${source.documentId}-${index}`} className="rounded-md border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/50">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-semibold text-slate-700">{source.documentName}</span>
                              <span className="text-xs text-slate-500">{source.score}</span>
                            </div>
                            <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{source.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
                )}
              </div>
              )}

              {activeSection === "history" && (
              <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
                <div className="h-1 bg-slate-900" />
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                      <History size={20} />
                    </div>
                    <div>
                      <h2 className="font-semibold text-slate-950">Chat History</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Review customer sessions, messages, and source citations.
                      </p>
                    </div>
                  </div>
                  <IconButton title="Refresh conversations" onClick={() => loadConversations()}>
                    <RefreshCcw size={16} />
                  </IconButton>
                </div>
                <div className="grid gap-4 border-b border-slate-200 p-5 md:grid-cols-3">
                  <MiniMetric icon={History} label="Conversations" value={conversations.length} />
                  <MiniMetric icon={MessageSquare} label="Messages" value={selectedConversationMessageCount} />
                  <MiniMetric
                    icon={Search}
                    label="Selected"
                    value={selectedConversation ? "Open" : "None"}
                  />
                </div>
                <div className="grid min-h-[520px] gap-0 md:grid-cols-[360px_minmax(0,1fr)]">
                  <div className="max-h-[640px] overflow-y-auto border-b border-slate-200 bg-slate-50/40 p-3 md:border-b-0 md:border-r">
                    {conversations.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                          <History size={20} />
                        </div>
                        <div className="font-semibold text-slate-800">No conversations yet</div>
                        <div className="mt-1">New widget and WhatsApp chats will appear here.</div>
                      </div>
                    ) : (
                      conversations.map((conversation) => (
                        <button
                          type="button"
                          key={conversation._id}
                          onClick={() => handleOpenConversation(conversation.sessionId)}
                          className={classNames(
                            "mb-2 flex w-full items-center gap-3 rounded-md border border-transparent bg-white px-3 py-3 text-left text-sm shadow-sm shadow-slate-200/40 transition hover:border-slate-200 hover:bg-slate-50",
                            selectedConversation?.sessionId === conversation.sessionId && "border-slate-300 bg-slate-100"
                          )}
                        >
                          <Search className="shrink-0 text-slate-400" size={16} />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-slate-800">
                              {conversation.customerPhone || conversation.sessionId}
                            </span>
                            <span className="block text-xs text-slate-500">{formatDate(conversation.updatedAt)}</span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="max-h-[640px] overflow-y-auto p-5 scrollbar-thin">
                    {!selectedConversation ? (
                      <div className="flex min-h-[440px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-sm text-slate-500">
                        Select a conversation to inspect messages.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedConversation.messages.map((message, index) => (
                          <div
                            key={`${message.role}-${index}`}
                            className={classNames(
                              "rounded-lg p-3 shadow-sm",
                              message.role === "user"
                                ? "bg-slate-900 text-white"
                                : "border border-slate-200 bg-white text-slate-800 shadow-slate-200/60"
                            )}
                          >
                            <div className="mb-1 text-xs font-semibold uppercase opacity-70">{message.role}</div>
                            <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                            {message.sources?.length > 0 && (
                              <div className="mt-3 space-y-2">
                                {message.sources.map((source, sourceIndex) => (
                                  <div key={sourceIndex} className="rounded-md bg-slate-50 p-2 text-slate-700">
                                    <div className="text-xs font-semibold">{source.documentName}</div>
                                    <div className="mt-1 text-xs leading-5">{source.content}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
              )}

              {activeSection === "help" && (
                <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
                  <div className="h-1 bg-slate-900" />
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                        <Search size={20} />
                      </div>
                      <div>
                        <h2 className="font-semibold text-slate-950">Widget Help</h2>
                        <p className="mt-1 text-xs text-slate-500">
                          Copy embed code and preview how the website widget will appear.
                        </p>
                      </div>
                    </div>
                    <SecondaryButton onClick={copyWidgetSnippet}>
                      <Code2 size={16} />
                      Copy Embed
                    </SecondaryButton>
                  </div>
                  <div className="grid gap-4 border-b border-slate-200 p-5 md:grid-cols-3">
                    <MiniMetric
                      icon={KeyRound}
                      label="API Key"
                      value={widgetApiKeyInput.trim() ? "Ready" : "Needed"}
                    />
                    <MiniMetric icon={Code2} label="Embed" value="Script" />
                    <MiniMetric icon={ExternalLink} label="Preview" value="Website" />
                  </div>
                  <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_500px]">
                    <div className="space-y-4">
                      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-inner shadow-slate-100">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs text-white">1</span>
                          Generate widget API key
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          Go to Company Dashboard and click Generate / Rotate. Copy the key when it appears.
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-inner shadow-slate-100">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs text-white">2</span>
                          Build and host widget file
                        </div>
                        <pre className="mt-3 overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-white shadow-sm">
{`cd C:\\Users\\Rashen\\Desktop\\github\\RAG-System\\frontend
npm.cmd run build:widget`}
                        </pre>
                        <p className="mt-2 text-sm text-slate-600">
                          Upload `dist-widget/rag-chat-widget.iife.js` to your server, CDN, or static hosting.
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-inner shadow-slate-100">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs text-white">3</span>
                          Paste embed code into website
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          Add the code before the closing body tag. Replace localhost URLs with deployed URLs in production.
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-inner shadow-slate-100">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs text-white">4</span>
                          Test from this dashboard
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          Paste the API key into Company Dashboard, then click Test Widget to open the real chatbot widget and send test messages.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Embed Code
                          </span>
                          <SecondaryButton onClick={copyWidgetSnippet}>
                            Copy
                          </SecondaryButton>
                        </div>
                        <pre className="max-h-[360px] overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs leading-5 text-slate-100 shadow-inner">
{widgetSnippet()}
                        </pre>
                        {!widgetApiKeyInput.trim() && (
                          <p className="mt-2 text-xs text-amber-700">
                            Paste or generate a key first to replace PASTE_WIDGET_API_KEY automatically.
                          </p>
                        )}
                      </div>
                      <div>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Small Preview
                        </div>
                        <div className="relative h-[380px] overflow-hidden rounded-lg border border-slate-200 bg-slate-100 p-4 shadow-inner shadow-slate-200">
                          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-950">{selectedCompany.name}</h3>
                            <p className="mt-1 text-sm text-slate-500">Customer website page</p>
                          </div>
                          <div className="absolute bottom-20 right-4 flex h-[250px] w-[280px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                            <div className="bg-slate-950 px-3 py-3 text-white">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                                    <MessageSquare size={15} />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate text-xs font-bold">{selectedCompany.name} Support</div>
                                    <div className="text-[11px] text-slate-300">Widget test mode</div>
                                  </div>
                                </div>
                                <X className="shrink-0 text-slate-300" size={16} />
                              </div>
                            </div>
                            <div className="flex-1 space-y-2 bg-white p-3">
                              <div className="flex gap-2">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white">
                                  <MessageSquare size={13} />
                                </div>
                                <div>
                                  <div className="max-w-[170px] rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm">
                                    Hi, how can I help?
                                  </div>
                                  <div className="mt-1 text-[10px] text-slate-400">10:30 AM</div>
                                </div>
                              </div>
                              <div className="ml-auto max-w-[85%] rounded-md bg-slate-950 px-3 py-2 text-xs text-white">
                                Ask a question
                              </div>
                            </div>
                            <div className="border-t border-slate-200 p-2">
                              <div className="flex gap-2">
                                <div className="relative h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 pr-7 text-xs leading-8 text-slate-400">
                                  Type your question
                                  <Smile className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                </div>
                                <div className="h-8 rounded-md bg-slate-950 px-3 text-xs font-semibold leading-8 text-white">
                                  Send
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="absolute bottom-4 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl">
                            <MessageSquare size={22} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
