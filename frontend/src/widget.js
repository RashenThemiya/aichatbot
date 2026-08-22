const DEFAULTS = {
  apiBaseUrl: "https://botbackend.pentarixlabs.com",
  companyId: "",
  title: "Support Chat",
  subtitle: "Ask from our knowledge base",
  accentColor: "#111827",
  headerColor: "",
  sendButtonColor: "",
  launcherColor: "",
  launcherIcon: "bot",
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

function normalizeColor(value, fallback) {
  if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) {
    return value;
  }

  return fallback;
}

function launcherIconMarkup(icon) {
  if (icon === "question") {
    return "?";
  }

  if (icon === "message") {
    return `
      <svg class="ragw-launcher-svg" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path>
      </svg>
    `;
  }

  return `
    <svg class="ragw-launcher-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8V4"></path>
      <path d="M8 4h8"></path>
      <rect x="5" y="8" width="14" height="11" rx="3"></rect>
      <path d="M9 13h.01"></path>
      <path d="M15 13h.01"></path>
      <path d="M9 16h6"></path>
    </svg>
  `;
}

function createStyle(config) {
  const style = document.createElement("style");
  const side = config.position === "left" ? "left" : "right";
  const accentColor = normalizeColor(config.accentColor, "#111827");
  const headerColor = normalizeColor(config.headerColor, accentColor);
  const sendButtonColor = normalizeColor(config.sendButtonColor, accentColor);
  const launcherColor = normalizeColor(config.launcherColor, accentColor);
  style.textContent = `
    .ragw-root{position:fixed;${side}:20px;bottom:20px;z-index:2147483000;font-family:Inter,system-ui,-apple-system,Segoe UI,Arial,sans-serif;color:#172033}
    .ragw-button{width:58px;height:58px;border:0;border-radius:999px;background:${launcherColor};color:#fff;box-shadow:0 18px 45px rgba(15,23,42,.28);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s ease,filter .15s ease}
    .ragw-button:hover{filter:brightness(.95);transform:translateY(-1px)}
    .ragw-launcher-svg{width:29px;height:29px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .ragw-panel{display:none;width:min(380px,calc(100vw - 32px));height:min(620px,calc(100vh - 104px));margin-bottom:14px;border:1px solid #d9e0ea;border-radius:10px;background:#fff;box-shadow:0 24px 70px rgba(15,23,42,.24);overflow:hidden}
    .ragw-open .ragw-panel{display:flex;flex-direction:column}
    .ragw-header{background:${headerColor};color:#fff;padding:14px 16px}
    .ragw-title{font-size:15px;font-weight:800;margin:0}
    .ragw-subtitle{font-size:12px;opacity:.82;margin:3px 0 0}
    .ragw-messages{flex:1;overflow:auto;padding:14px;background:#f6f8fb}
    .ragw-msg{max-width:88%;padding:11px 13px;margin:0 0 12px;border-radius:12px;font-size:14px;line-height:1.55;box-shadow:0 2px 8px rgba(15,23,42,.05)}
    .ragw-user{margin-left:auto;background:${sendButtonColor};color:#fff}
    .ragw-bot{background:#fff;border:1px solid #e1e7ef;color:#172033}
    .ragw-sources{margin-top:8px;border-top:1px solid #e6ebf2;padding-top:7px;font-size:11px;color:#64748b}
    .ragw-suggestions{display:grid;gap:6px;margin-top:10px}.ragw-suggestion{width:100%;border:1px solid #cbd5e1;border-radius:7px;background:#f8fafc;color:#1e293b;padding:8px 9px;text-align:left;font:inherit;font-size:12px;line-height:1.35;cursor:pointer}.ragw-suggestion:hover{border-color:${sendButtonColor};background:#f1f5f9}.ragw-suggestion:disabled{opacity:.55;cursor:not-allowed}
    .ragw-line{min-height:1em;margin:0 0 5px}.ragw-line:last-child{margin-bottom:0}
    .ragw-list{padding-left:18px;margin:6px 0}.ragw-list li{margin:3px 0}
    .ragw-feedback{display:flex;align-items:center;gap:6px;margin-top:9px;padding-top:8px;border-top:1px solid #eef2f7;color:#64748b;font-size:11px}
    .ragw-feedback button{border:1px solid #dbe3ed;background:#fff;border-radius:6px;padding:4px 7px;cursor:pointer;color:#475569}
    .ragw-feedback button:hover,.ragw-feedback button.ragw-selected{border-color:#94a3b8;background:#f1f5f9;color:#0f172a}
    .ragw-typing{display:flex;gap:4px;align-items:center;width:48px}
    .ragw-dot{width:6px;height:6px;border-radius:50%;background:#94a3b8;animation:ragw-pulse 1.2s infinite}
    .ragw-dot:nth-child(2){animation-delay:.15s}.ragw-dot:nth-child(3){animation-delay:.3s}
    @keyframes ragw-pulse{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
    .ragw-form{display:flex;gap:8px;padding:12px;border-top:1px solid #e1e7ef;background:#fff}
    .ragw-input{flex:1;min-width:0;height:40px;border:1px solid #cbd5e1;border-radius:7px;padding:0 10px;font-size:14px;outline:none}
    .ragw-send{height:40px;border:0;border-radius:7px;background:${sendButtonColor};color:#fff;padding:0 14px;font-weight:700;cursor:pointer}
    .ragw-send:disabled{opacity:.55;cursor:not-allowed}
  `;
  document.head.appendChild(style);
}

function appendFormattedText(container, text) {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  for (const part of text.split(pattern).filter(Boolean)) {
    if (part.startsWith("**") && part.endsWith("**")) {
      const strong = document.createElement("strong");
      strong.textContent = part.slice(2, -2);
      container.appendChild(strong);
    } else if (part.startsWith("*") && part.endsWith("*")) {
      const em = document.createElement("em");
      em.textContent = part.slice(1, -1);
      container.appendChild(em);
    } else {
      container.appendChild(document.createTextNode(part));
    }
  }
}

function appendFormattedAnswer(node, text) {
  let list = null;
  for (const rawLine of String(text || "").split("\n")) {
    const match = rawLine.match(/^\s*[-*]\s+(.+)/);
    if (match) {
      if (!list) {
        list = document.createElement("ul");
        list.className = "ragw-list";
        node.appendChild(list);
      }
      const item = document.createElement("li");
      appendFormattedText(item, match[1]);
      list.appendChild(item);
      continue;
    }
    list = null;
    const line = document.createElement("div");
    line.className = "ragw-line";
    appendFormattedText(line, rawLine);
    node.appendChild(line);
  }
}

function messageNode(role, text, sources = [], feedbackOptions = null, suggestions = []) {
  const node = document.createElement("div");
  node.className = `ragw-msg ${role === "user" ? "ragw-user" : "ragw-bot"}`;
  appendFormattedAnswer(node, text);
  if (sources.length) {
    const sourceBox = document.createElement("div");
    sourceBox.className = "ragw-sources";
    sourceBox.textContent = `Sources: ${sources.map((source) => source.documentName).filter(Boolean).join(", ")}`;
    node.appendChild(sourceBox);
  }
  if (role !== "user" && suggestions.length) {
    const choices = document.createElement("div");
    choices.className = "ragw-suggestions";
    for (const suggestion of suggestions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ragw-suggestion";
      button.textContent = suggestion.label;
      button.addEventListener("click", () => {
        choices.querySelectorAll("button").forEach((item) => { item.disabled = true; });
        feedbackOptions?.onSuggestion?.(suggestion.message);
      });
      choices.appendChild(button);
    }
    node.appendChild(choices);
  }
  if (role !== "user" && feedbackOptions) {
    const feedback = document.createElement("div");
    feedback.className = "ragw-feedback";
    feedback.appendChild(document.createTextNode("Was this helpful?"));
    for (const [value, label] of [["helpful", "👍 Yes"], ["not_helpful", "👎 No"]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", async () => {
        feedback.querySelectorAll("button").forEach((item) => item.classList.remove("ragw-selected"));
        button.classList.add("ragw-selected");
        await feedbackOptions.onFeedback(value);
      });
      feedback.appendChild(button);
    }
    node.appendChild(feedback);
  }
  return node;
}

function typingNode() {
  const node = document.createElement("div");
  node.className = "ragw-msg ragw-bot ragw-typing";
  node.setAttribute("aria-label", "Assistant is typing");
  node.innerHTML = '<span class="ragw-dot"></span><span class="ragw-dot"></span><span class="ragw-dot"></span>';
  return node;
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

async function sendFeedback(config, conversationId, feedback) {
  if (!conversationId) return;
  await fetch(`${config.apiBaseUrl}/widget/companies/${config.companyId}/chat/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Widget-API-Key": config.apiKey,
    },
    body: JSON.stringify({ conversationId, feedback }),
  });
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
        <p class="ragw-title"></p>
        <p class="ragw-subtitle"></p>
      </header>
      <div class="ragw-messages"></div>
      <form class="ragw-form">
        <input class="ragw-input" type="text" placeholder="Type your question" autocomplete="off" />
        <button class="ragw-send" type="submit">Send</button>
      </form>
    </section>
    <button class="ragw-button" type="button" aria-label="Open chat">${launcherIconMarkup(config.launcherIcon)}</button>
  `;

  root.querySelector(".ragw-title").textContent = config.title;
  root.querySelector(".ragw-subtitle").textContent = config.subtitle;
  const messages = root.querySelector(".ragw-messages");
  const input = root.querySelector(".ragw-input");
  const form = root.querySelector(".ragw-form");
  const send = root.querySelector(".ragw-send");
  const toggle = root.querySelector(".ragw-button");

  async function submitMessage(text) {
    if (!text) return;
    input.value = "";
    messages.appendChild(messageNode("user", text));
    messages.scrollTop = messages.scrollHeight;
    send.disabled = true;
    const typing = typingNode();
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;
    try {
      const result = await sendMessage(config, text, sessionId);
      typing.remove();
      messages.appendChild(messageNode(
        "bot",
        result.answer,
        result.sources || [],
        {
          onFeedback: (feedback) => sendFeedback(config, result.conversationId, feedback),
          onSuggestion: submitMessage,
        },
        result.suggestions || []
      ));
    } catch (error) {
      typing.remove();
      messages.appendChild(messageNode("bot", error.message || "Unable to send message."));
    } finally {
      send.disabled = false;
      messages.scrollTop = messages.scrollHeight;
    }
  }

  messages.appendChild(messageNode("bot", config.greeting || "Hi, how can I help?"));
  toggle.addEventListener("click", () => root.classList.toggle("ragw-open"));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitMessage(input.value.trim());
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
