(function(){"use strict";var w;const b={apiBaseUrl:"https://botbackend.pentarixlabs.com",companyId:"",title:"Support Chat",subtitle:"Ask from our knowledge base",accentColor:"#111827",headerColor:"",sendButtonColor:"",launcherColor:"",launcherIcon:"bot",position:"right",apiKey:""};function x(e){const o=`rag_widget_session_${e}`;let r=localStorage.getItem(o);return r||(r=`web_${crypto.randomUUID()}`,localStorage.setItem(o,r)),r}function l(e,o){return typeof e=="string"&&/^#[0-9a-fA-F]{6}$/.test(e)?e:o}function y(e){return e==="question"?"?":e==="message"?`
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
  `}function C(e){const o=document.createElement("style"),r=e.position==="left"?"left":"right",t=l(e.accentColor,"#111827"),a=l(e.headerColor,t),n=l(e.sendButtonColor,t),s=l(e.launcherColor,t);o.textContent=`
    .ragw-root{position:fixed;${r}:20px;bottom:20px;z-index:2147483000;font-family:Inter,system-ui,-apple-system,Segoe UI,Arial,sans-serif;color:#172033}
    .ragw-button{width:58px;height:58px;border:0;border-radius:999px;background:${s};color:#fff;box-shadow:0 18px 45px rgba(15,23,42,.28);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s ease,filter .15s ease}
    .ragw-button:hover{filter:brightness(.95);transform:translateY(-1px)}
    .ragw-launcher-svg{width:29px;height:29px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .ragw-panel{display:none;width:min(380px,calc(100vw - 32px));height:min(620px,calc(100vh - 104px));margin-bottom:14px;border:1px solid #d9e0ea;border-radius:10px;background:#fff;box-shadow:0 24px 70px rgba(15,23,42,.24);overflow:hidden}
    .ragw-open .ragw-panel{display:flex;flex-direction:column}
    .ragw-header{background:${a};color:#fff;padding:14px 16px}
    .ragw-title{font-size:15px;font-weight:800;margin:0}
    .ragw-subtitle{font-size:12px;opacity:.82;margin:3px 0 0}
    .ragw-messages{flex:1;overflow:auto;padding:14px;background:#f6f8fb}
    .ragw-msg{max-width:88%;padding:11px 13px;margin:0 0 12px;border-radius:12px;font-size:14px;line-height:1.55;box-shadow:0 2px 8px rgba(15,23,42,.05)}
    .ragw-user{margin-left:auto;background:${n};color:#fff}
    .ragw-bot{background:#fff;border:1px solid #e1e7ef;color:#172033}
    .ragw-sources{margin-top:8px;border-top:1px solid #e6ebf2;padding-top:7px;font-size:11px;color:#64748b}
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
    .ragw-send{height:40px;border:0;border-radius:7px;background:${n};color:#fff;padding:0 14px;font-weight:700;cursor:pointer}
    .ragw-send:disabled{opacity:.55;cursor:not-allowed}
  `,document.head.appendChild(o)}function f(e,o){const r=/(\*\*[^*]+\*\*|\*[^*]+\*)/g;for(const t of o.split(r).filter(Boolean))if(t.startsWith("**")&&t.endsWith("**")){const a=document.createElement("strong");a.textContent=t.slice(2,-2),e.appendChild(a)}else if(t.startsWith("*")&&t.endsWith("*")){const a=document.createElement("em");a.textContent=t.slice(1,-1),e.appendChild(a)}else e.appendChild(document.createTextNode(t))}function k(e,o){let r=null;for(const t of String(o||"").split(`
`)){const a=t.match(/^\s*[-*]\s+(.+)/);if(a){r||(r=document.createElement("ul"),r.className="ragw-list",e.appendChild(r));const s=document.createElement("li");f(s,a[1]),r.appendChild(s);continue}r=null;const n=document.createElement("div");n.className="ragw-line",f(n,t),e.appendChild(n)}}function c(e,o,r=[],t=null){const a=document.createElement("div");if(a.className=`ragw-msg ${e==="user"?"ragw-user":"ragw-bot"}`,k(a,o),r.length){const n=document.createElement("div");n.className="ragw-sources",n.textContent=`Sources: ${r.map(s=>s.documentName).filter(Boolean).join(", ")}`,a.appendChild(n)}if(e!=="user"&&t){const n=document.createElement("div");n.className="ragw-feedback",n.appendChild(document.createTextNode("Was this helpful?"));for(const[s,p]of[["helpful","👍 Yes"],["not_helpful","👎 No"]]){const i=document.createElement("button");i.type="button",i.textContent=p,i.addEventListener("click",async()=>{n.querySelectorAll("button").forEach(u=>u.classList.remove("ragw-selected")),i.classList.add("ragw-selected"),await t.onFeedback(s)}),n.appendChild(i)}a.appendChild(n)}return a}function v(){const e=document.createElement("div");return e.className="ragw-msg ragw-bot ragw-typing",e.setAttribute("aria-label","Assistant is typing"),e.innerHTML='<span class="ragw-dot"></span><span class="ragw-dot"></span><span class="ragw-dot"></span>',e}async function E(e,o,r){const t=await fetch(`${e.apiBaseUrl}/widget/companies/${e.companyId}/chat`,{method:"POST",headers:{"Content-Type":"application/json","X-Widget-API-Key":e.apiKey},body:JSON.stringify({message:o,sessionId:r,customerName:e.customerName||"",customerEmail:e.customerEmail||"",customerPhone:e.customerPhone||""})}),a=await t.json();if(!t.ok)throw new Error(a.error||"Chat request failed");return a}async function S(e,o,r){o&&await fetch(`${e.apiBaseUrl}/widget/companies/${e.companyId}/chat/feedback`,{method:"POST",headers:{"Content-Type":"application/json","X-Widget-API-Key":e.apiKey},body:JSON.stringify({conversationId:o,feedback:r})})}function g(e={}){const o={...b,...window.RAG_CHAT_WIDGET,...e};if(!o.companyId){console.error("[RAG Widget] companyId is required");return}C(o);const r=x(o.companyId),t=document.createElement("div");t.className="ragw-root",t.innerHTML=`
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
    <button class="ragw-button" type="button" aria-label="Open chat">${y(o.launcherIcon)}</button>
  `,t.querySelector(".ragw-title").textContent=o.title,t.querySelector(".ragw-subtitle").textContent=o.subtitle;const a=t.querySelector(".ragw-messages"),n=t.querySelector(".ragw-input"),s=t.querySelector(".ragw-form"),p=t.querySelector(".ragw-send"),i=t.querySelector(".ragw-button");a.appendChild(c("bot",o.greeting||"Hi, how can I help?")),i.addEventListener("click",()=>t.classList.toggle("ragw-open")),s.addEventListener("submit",async u=>{u.preventDefault();const h=n.value.trim();if(!h)return;n.value="",a.appendChild(c("user",h)),a.scrollTop=a.scrollHeight,p.disabled=!0;const m=v();a.appendChild(m),a.scrollTop=a.scrollHeight;try{const d=await E(o,h,r);m.remove(),a.appendChild(c("bot",d.answer,d.sources||[],{onFeedback:I=>S(o,d.conversationId,I)}))}catch(d){m.remove(),a.appendChild(c("bot",d.message||"Unable to send message."))}finally{p.disabled=!1,a.scrollTop=a.scrollHeight}}),document.body.appendChild(t)}window.RAGChatWidget={init:g},((w=window.RAG_CHAT_WIDGET)==null?void 0:w.autoInit)!==!1&&(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>g()):g())})();
