const DEFAULTS = {
  apiBaseUrl: "http://localhost:3000",
  companyId: "",
  title: "Support Chat",
  subtitle: "Ask from our knowledge base",
  accentColor: "#111827",
  position: "right",
  apiKey: "",
};

function getSessionId(companyId) {
  const key = `rag_widget_session_${companyId}`;
  let value = localStorage.getItem(key);
  if (!value) {
    value = `web_${crypto.randomUUID()}`;
    localStorage.setItem(key, value);
  }
  return value;
}

function createStyle(config) {
  const style = document.createElement("style");
  const side = config.position === "left" ? "left" : "right";
  style.textContent = `
    .ragw-root{position:fixed;${side}:20px;bottom:20px;z-index:2147483000;font-family:Inter,system-ui,-apple-system,Segoe UI,Arial,sans-serif;color:#172033}
    .ragw-button{display:flex;align-items:center;justify-content:center;width:58px;height:58px;border:0;border-radius:999px;background:${config.accentColor};color:#fff;box-shadow:0 18px 45px rgba(15,23,42,.28);cursor:pointer}
    .ragw-panel{display:none;width:min(420px,calc(100vw - 32px));height:min(640px,calc(100vh - 104px));margin-bottom:14px;border:1px solid #d9e0ea;border-radius:10px;background:#fff;box-shadow:0 24px 70px rgba(15,23,42,.24);overflow:hidden}
    .ragw-open .ragw-panel{display:flex;flex-direction:column}
    .ragw-header{display:flex;align-items:center;justify-content:space-between;gap:12px;background:${config.accentColor};color:#fff;padding:16px}
    .ragw-heading{display:flex;min-width:0;align-items:center;gap:12px}
    .ragw-avatar{display:flex;flex:0 0 auto;align-items:center;justify-content:center;width:40px;height:40px;border-radius:999px;background:rgba(255,255,255,.1);box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
    .ragw-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:16px;font-weight:800;margin:0}
    .ragw-subtitle{font-size:12px;opacity:.78;margin:3px 0 0}
    .ragw-actions{display:flex;flex:0 0 auto;align-items:center;gap:8px}
    .ragw-iconbtn{display:flex;align-items:center;justify-content:center;width:40px;height:40px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:rgba(255,255,255,.06);color:#fff;cursor:pointer}
    .ragw-iconbtn:hover{background:rgba(255,255,255,.12)}
    .ragw-messages{flex:1;overflow:auto;padding:20px;background:#fff}
    .ragw-row{display:flex;gap:12px;margin:0 0 16px}
    .ragw-row-user{justify-content:flex-end}
    .ragw-msgwrap{max-width:78%}
    .ragw-msg{padding:11px 14px;border-radius:10px;font-size:14px;line-height:1.5;white-space:pre-wrap;box-shadow:0 1px 3px rgba(15,23,42,.06)}
    .ragw-user{background:${config.accentColor};color:#fff}
    .ragw-bot{background:#fff;border:1px solid #e1e7ef;color:#172033}
    .ragw-time{margin-top:7px;font-size:11px;color:#94a3b8}
    .ragw-row-user .ragw-time{text-align:right}
    .ragw-sources{margin-top:8px;border-top:1px solid #e6ebf2;padding-top:7px;font-size:11px;color:#64748b}
    .ragw-form{display:flex;gap:8px;padding:16px;border-top:1px solid #e1e7ef;background:#fff}
    .ragw-inputwrap{position:relative;flex:1;min-width:0}
    .ragw-input{box-sizing:border-box;width:100%;height:44px;border:1px solid #cbd5e1;border-radius:8px;padding:0 42px 0 14px;font-size:14px;outline:none;color:#172033}
    .ragw-input:focus{border-color:#64748b;box-shadow:0 0 0 3px rgba(100,116,139,.16)}
    .ragw-smile{position:absolute;right:12px;top:50%;transform:translateY(-50%);color:#64748b;pointer-events:none}
    .ragw-send{height:44px;border:0;border-radius:8px;background:${config.accentColor};color:#fff;padding:0 18px;font-weight:800;cursor:pointer;box-shadow:0 8px 18px rgba(15,23,42,.16)}
    .ragw-send:disabled{opacity:.55;cursor:not-allowed}
  `;
  document.head.appendChild(style);
}

function messageNode(role, text, sources = []) {
  const row = document.createElement("div");
  row.className = `ragw-row ${role === "user" ? "ragw-row-user" : ""}`;
  if (role !== "user") {
    const avatar = document.createElement("div");
    avatar.className = "ragw-avatar";
    avatar.innerHTML = chatIconSvg(18);
    row.appendChild(avatar);
  }

  const wrap = document.createElement("div");
  wrap.className = "ragw-msgwrap";

  const node = document.createElement("div");
  node.className = `ragw-msg ${role === "user" ? "ragw-user" : "ragw-bot"}`;
  node.textContent = text;
  if (sources.length) {
    const sourceBox = document.createElement("div");
    sourceBox.className = "ragw-sources";
    sourceBox.textContent = `Sources: ${sources.map((source) => source.documentName).filter(Boolean).join(", ")}`;
    node.appendChild(sourceBox);
  }

  const time = document.createElement("div");
  time.className = "ragw-time";
  time.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  wrap.appendChild(node);
  wrap.appendChild(time);
  row.appendChild(wrap);
  return row;
}

function chatIconSvg(size = 22) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6A8.4 8.4 0 0 1 12.5 3H13a8.5 8.5 0 0 1 8 8v.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 12h.01M12 12h.01M16 12h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
}

function menuIconSvg() {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M12 8h.01M12 12h.01M12 16h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
}

function closeIconSvg() {
  return '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
}

function smileIconSvg() {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
}

async function sendMessage(config, message, sessionId) {
  const response = await fetch(`${config.apiBaseUrl}/widget/companies/${config.companyId}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Widget-API-Key": config.apiKey,
    },
    body: JSON.stringify({
      message,
      sessionId,
      customerName: config.customerName || "",
      customerEmail: config.customerEmail || "",
      customerPhone: config.customerPhone || "",
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Chat request failed");
  return data;
}

function initWidget(options = {}) {
  const config = { ...DEFAULTS, ...window.RAG_CHAT_WIDGET, ...options };
  if (!config.companyId) {
    console.error("[RAG Widget] companyId is required");
    return;
  }

  createStyle(config);
  const sessionId = getSessionId(config.companyId);
  const root = document.createElement("div");
  root.className = "ragw-root";
  root.innerHTML = `
    <section class="ragw-panel">
      <header class="ragw-header">
        <div class="ragw-heading">
          <div class="ragw-avatar">${chatIconSvg(19)}</div>
          <div>
            <p class="ragw-title"></p>
            <p class="ragw-subtitle"></p>
          </div>
        </div>
        <div class="ragw-actions">
          <button class="ragw-iconbtn" type="button" aria-label="More options">${menuIconSvg()}</button>
          <button class="ragw-iconbtn ragw-close" type="button" aria-label="Close chat">${closeIconSvg()}</button>
        </div>
      </header>
      <div class="ragw-messages"></div>
      <form class="ragw-form">
        <div class="ragw-inputwrap">
          <input class="ragw-input" type="text" placeholder="Type your question" autocomplete="off" />
          <span class="ragw-smile">${smileIconSvg()}</span>
        </div>
        <button class="ragw-send" type="submit">Send</button>
      </form>
    </section>
    <button class="ragw-button" type="button" aria-label="Open chat">${chatIconSvg(24)}</button>
  `;

  root.querySelector(".ragw-title").textContent = config.title;
  root.querySelector(".ragw-subtitle").textContent = config.subtitle;
  const messages = root.querySelector(".ragw-messages");
  const input = root.querySelector(".ragw-input");
  const form = root.querySelector(".ragw-form");
  const send = root.querySelector(".ragw-send");
  const toggle = root.querySelector(".ragw-button");
  const close = root.querySelector(".ragw-close");

  messages.appendChild(messageNode("bot", "Hi, how can I help?"));
  toggle.addEventListener("click", () => root.classList.toggle("ragw-open"));
  close.addEventListener("click", () => root.classList.remove("ragw-open"));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    messages.appendChild(messageNode("user", text));
    messages.scrollTop = messages.scrollHeight;
    send.disabled = true;
    try {
      const result = await sendMessage(config, text, sessionId);
      messages.appendChild(messageNode("bot", result.answer, result.sources || []));
    } catch (error) {
      messages.appendChild(messageNode("bot", error.message || "Unable to send message."));
    } finally {
      send.disabled = false;
      messages.scrollTop = messages.scrollHeight;
    }
  });

  document.body.appendChild(root);
}

window.RAGChatWidget = { init: initWidget };

if (window.RAG_CHAT_WIDGET?.autoInit !== false) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initWidget());
  } else {
    initWidget();
  }
}
