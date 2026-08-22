(function(){"use strict";var w;const b={apiBaseUrl:"https://botbackend.pentarixlabs.com",companyId:"",title:"Support Chat",subtitle:"Ask from our knowledge base",accentColor:"#111827",headerColor:"",sendButtonColor:"",launcherColor:"",launcherIcon:"bot",position:"right",apiKey:""};function x(e){const a=`rag_widget_session_${e}`;let r=localStorage.getItem(a);return r||(r=`web_${crypto.randomUUID()}`,localStorage.setItem(a,r)),r}function g(e,a){return typeof e=="string"&&/^#[0-9a-fA-F]{6}$/.test(e)?e:a}function y(e){return e==="question"?"?":e==="message"?`
      <svg class="ragw-launcher-svg" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path>
      </svg>
    `:`
    <svg class="ragw-launcher-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8V4"></path>
      <path d="M8 4h8"></path>
      <rect x="5" y="8" width="14" height="11" rx="3"></rect>
      <path d="M9 13h.01"></path>
      <path d="M15 13h.01"></path>
      <path d="M9 16h6"></path>
    </svg>
  `}function C(e){const a=document.createElement("style"),r=e.position==="left"?"left":"right",t=g(e.accentColor,"#111827"),o=g(e.headerColor,t),s=g(e.sendButtonColor,t),n=g(e.launcherColor,t);a.textContent=`
    .ragw-root{position:fixed;${r}:20px;bottom:20px;z-index:2147483000;font-family:Inter,system-ui,-apple-system,Segoe UI,Arial,sans-serif;color:#172033}
    .ragw-button{width:58px;height:58px;border:0;border-radius:999px;background:${n};color:#fff;box-shadow:0 18px 45px rgba(15,23,42,.28);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s ease,filter .15s ease}
    .ragw-button:hover{filter:brightness(.95);transform:translateY(-1px)}
    .ragw-launcher-svg{width:29px;height:29px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .ragw-panel{display:none;width:min(380px,calc(100vw - 32px));height:min(620px,calc(100vh - 104px));margin-bottom:14px;border:1px solid #d9e0ea;border-radius:10px;background:#fff;box-shadow:0 24px 70px rgba(15,23,42,.24);overflow:hidden}
    .ragw-open .ragw-panel{display:flex;flex-direction:column}
    .ragw-header{background:${o};color:#fff;padding:14px 16px}
    .ragw-title{font-size:15px;font-weight:800;margin:0}
    .ragw-subtitle{font-size:12px;opacity:.82;margin:3px 0 0}
    .ragw-messages{flex:1;overflow:auto;padding:14px;background:#f6f8fb}
    .ragw-msg{max-width:88%;padding:11px 13px;margin:0 0 12px;border-radius:12px;font-size:14px;line-height:1.55;box-shadow:0 2px 8px rgba(15,23,42,.05)}
    .ragw-user{margin-left:auto;background:${s};color:#fff}
    .ragw-bot{background:#fff;border:1px solid #e1e7ef;color:#172033}
    .ragw-sources{margin-top:8px;border-top:1px solid #e6ebf2;padding-top:7px;font-size:11px;color:#64748b}
    .ragw-suggestions{display:grid;gap:6px;margin-top:10px}.ragw-suggestion{width:100%;border:1px solid #cbd5e1;border-radius:7px;background:#f8fafc;color:#1e293b;padding:8px 9px;text-align:left;font:inherit;font-size:12px;line-height:1.35;cursor:pointer}.ragw-suggestion:hover{border-color:${s};background:#f1f5f9}.ragw-suggestion:disabled{opacity:.55;cursor:not-allowed}
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
    .ragw-send{height:40px;border:0;border-radius:7px;background:${s};color:#fff;padding:0 14px;font-weight:700;cursor:pointer}
    .ragw-send:disabled{opacity:.55;cursor:not-allowed}
  `,document.head.appendChild(a)}function f(e,a){const r=/(\*\*[^*]+\*\*|\*[^*]+\*)/g;for(const t of a.split(r).filter(Boolean))if(t.startsWith("**")&&t.endsWith("**")){const o=document.createElement("strong");o.textContent=t.slice(2,-2),e.appendChild(o)}else if(t.startsWith("*")&&t.endsWith("*")){const o=document.createElement("em");o.textContent=t.slice(1,-1),e.appendChild(o)}else e.appendChild(document.createTextNode(t))}function v(e,a){let r=null;for(const t of String(a||"").split(`
`)){const o=t.match(/^\s*[-*]\s+(.+)/);if(o){r||(r=document.createElement("ul"),r.className="ragw-list",e.appendChild(r));const n=document.createElement("li");f(n,o[1]),r.appendChild(n);continue}r=null;const s=document.createElement("div");s.className="ragw-line",f(s,t),e.appendChild(s)}}function u(e,a,r=[],t=null,o=[]){const s=document.createElement("div");if(s.className=`ragw-msg ${e==="user"?"ragw-user":"ragw-bot"}`,v(s,a),r.length){const n=document.createElement("div");n.className="ragw-sources",n.textContent=`Sources: ${r.map(d=>d.documentName).filter(Boolean).join(", ")}`,s.appendChild(n)}if(e!=="user"&&o.length){const n=document.createElement("div");n.className="ragw-suggestions";for(const d of o){const l=document.createElement("button");l.type="button",l.className="ragw-suggestion",l.textContent=d.label,l.addEventListener("click",()=>{var i;n.querySelectorAll("button").forEach(c=>{c.disabled=!0}),(i=t==null?void 0:t.onSuggestion)==null||i.call(t,d.message)}),n.appendChild(l)}s.appendChild(n)}if(e!=="user"&&t){const n=document.createElement("div");n.className="ragw-feedback",n.appendChild(document.createTextNode("Was this helpful?"));for(const[d,l]of[["helpful","👍 Yes"],["not_helpful","👎 No"]]){const i=document.createElement("button");i.type="button",i.textContent=l,i.addEventListener("click",async()=>{n.querySelectorAll("button").forEach(c=>c.classList.remove("ragw-selected")),i.classList.add("ragw-selected"),await t.onFeedback(d)}),n.appendChild(i)}s.appendChild(n)}return s}function k(){const e=document.createElement("div");return e.className="ragw-msg ragw-bot ragw-typing",e.setAttribute("aria-label","Assistant is typing"),e.innerHTML='<span class="ragw-dot"></span><span class="ragw-dot"></span><span class="ragw-dot"></span>',e}async function E(e,a,r){const t=await fetch(`${e.apiBaseUrl}/widget/companies/${e.companyId}/chat`,{method:"POST",headers:{"Content-Type":"application/json","X-Widget-API-Key":e.apiKey},body:JSON.stringify({message:a,sessionId:r,customerName:e.customerName||"",customerEmail:e.customerEmail||"",customerPhone:e.customerPhone||""})}),o=await t.json();if(!t.ok)throw new Error(o.error||"Chat request failed");return o}async function S(e,a,r){a&&await fetch(`${e.apiBaseUrl}/widget/companies/${e.companyId}/chat/feedback`,{method:"POST",headers:{"Content-Type":"application/json","X-Widget-API-Key":e.apiKey},body:JSON.stringify({conversationId:a,feedback:r})})}function h(e={}){const a={...b,...window.RAG_CHAT_WIDGET,...e};if(!a.companyId){console.error("[RAG Widget] companyId is required");return}C(a);const r=x(a.companyId),t=document.createElement("div");t.className="ragw-root",t.innerHTML=`
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
    <button class="ragw-button" type="button" aria-label="Open chat">${y(a.launcherIcon)}</button>
  `,t.querySelector(".ragw-title").textContent=a.title,t.querySelector(".ragw-subtitle").textContent=a.subtitle;const o=t.querySelector(".ragw-messages"),s=t.querySelector(".ragw-input"),n=t.querySelector(".ragw-form"),d=t.querySelector(".ragw-send"),l=t.querySelector(".ragw-button");async function i(c){if(!c)return;s.value="",o.appendChild(u("user",c)),o.scrollTop=o.scrollHeight,d.disabled=!0;const m=k();o.appendChild(m),o.scrollTop=o.scrollHeight;try{const p=await E(a,c,r);m.remove(),o.appendChild(u("bot",p.answer,p.sources||[],{onFeedback:I=>S(a,p.conversationId,I),onSuggestion:i},p.suggestions||[]))}catch(p){m.remove(),o.appendChild(u("bot",p.message||"Unable to send message."))}finally{d.disabled=!1,o.scrollTop=o.scrollHeight}}o.appendChild(u("bot",a.greeting||"Hi, how can I help?")),l.addEventListener("click",()=>t.classList.toggle("ragw-open")),n.addEventListener("submit",async c=>{c.preventDefault(),await i(s.value.trim())}),document.body.appendChild(t)}window.RAGChatWidget={init:h},((w=window.RAG_CHAT_WIDGET)==null?void 0:w.autoInit)!==!1&&(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>h()):h())})();
