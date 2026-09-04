(function(){"use strict";var k;const S={apiBaseUrl:"https://botbackend.pentarixlabs.com",companyId:"",title:"Support Chat",subtitle:"Ask from our knowledge base",accentColor:"#111827",headerColor:"",headerTextColor:"",sendButtonColor:"",launcherColor:"",launcherIcon:"bot",position:"right",apiKey:"",showFeedback:!1};function I(e){const a=`rag_widget_session_${e}`;let r=localStorage.getItem(a);return r||(r=`web_${crypto.randomUUID()}`,localStorage.setItem(a,r)),r}function f(e,a){return typeof e=="string"&&/^#[0-9a-fA-F]{6}$/.test(e)?e:a}function A(e){return e==="question"?"?":e==="message"?`
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
  `}function T(e){const a=document.createElement("style"),r=e.position==="left"?"left":"right",t=f(e.accentColor,"#111827"),o=f(e.headerColor,t),s=f(e.headerTextColor,"#ffffff"),n=f(e.sendButtonColor,t),i=f(e.launcherColor,t);a.textContent=`
    .ragw-root{position:fixed;${r}:20px;bottom:20px;z-index:2147483000;font-family:Inter,system-ui,-apple-system,Segoe UI,Arial,sans-serif;color:#172033}
    .ragw-button{width:58px;height:58px;border:0;border-radius:999px;background:${i};color:#fff;box-shadow:0 18px 45px rgba(15,23,42,.28);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s ease,filter .15s ease}
    .ragw-button:hover{filter:brightness(.95);transform:translateY(-1px)}
    .ragw-launcher-svg{width:29px;height:29px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .ragw-panel{display:none;width:min(380px,calc(100vw - 32px));height:min(620px,calc(100vh - 104px));margin-bottom:14px;border:1px solid #d9e0ea;border-radius:10px;background:#fff;box-shadow:0 24px 70px rgba(15,23,42,.24);overflow:hidden}
    .ragw-open .ragw-panel{display:flex;flex-direction:column}
    .ragw-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;background:${o};color:${s};padding:14px 16px}
    .ragw-header-copy{min-width:0}
    .ragw-title{font-size:15px;font-weight:800;margin:0}
    .ragw-subtitle{font-size:12px;opacity:.82;margin:3px 0 0}
    .ragw-close{display:grid;flex:0 0 auto;width:28px;height:28px;padding:0;border:0;border-radius:999px;background:transparent;color:inherit;font-size:22px;line-height:1;cursor:pointer;place-items:center}.ragw-close:hover{background:rgba(127,127,127,.14)}
    .ragw-messages{flex:1;overflow:auto;padding:14px;background:#f6f8fb}
    .ragw-msg{max-width:88%;padding:11px 13px;margin:0 0 12px;border-radius:12px;font-size:14px;line-height:1.55;box-shadow:0 2px 8px rgba(15,23,42,.05)}
    .ragw-user{margin-left:auto;background:${n};color:#fff}
    .ragw-bot{background:#fff;border:1px solid #e1e7ef;color:#172033}
    .ragw-sources{margin-top:8px;border-top:1px solid #e6ebf2;padding-top:7px;font-size:11px;color:#64748b}
    .ragw-suggestions{display:grid;gap:6px;margin-top:10px}.ragw-suggestion{width:100%;border:1px solid #cbd5e1;border-radius:7px;background:#f8fafc;color:#1e293b;padding:8px 9px;text-align:left;font:inherit;font-size:12px;line-height:1.35;cursor:pointer}.ragw-suggestion:hover{border-color:${n};background:#f1f5f9}.ragw-suggestion:disabled{opacity:.55;cursor:not-allowed}
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
  `,document.head.appendChild(a)}function y(e,a){const r=/(\*\*[^*]+\*\*|\*[^*]+\*)/g;for(const t of a.split(r).filter(Boolean))if(t.startsWith("**")&&t.endsWith("**")){const o=document.createElement("strong");o.textContent=t.slice(2,-2),e.appendChild(o)}else if(t.startsWith("*")&&t.endsWith("*")){const o=document.createElement("em");o.textContent=t.slice(1,-1),e.appendChild(o)}else e.appendChild(document.createTextNode(t))}function $(e,a){let r=null;for(const t of String(a||"").split(`
`)){const o=t.match(/^\s*[-*]\s+(.+)/);if(o){r||(r=document.createElement("ul"),r.className="ragw-list",e.appendChild(r));const n=document.createElement("li");y(n,o[1]),r.appendChild(n);continue}r=null;const s=document.createElement("div");s.className="ragw-line",y(s,t),e.appendChild(s)}}function h(e,a,r=[],t=null,o=[]){const s=document.createElement("div");if(s.className=`ragw-msg ${e==="user"?"ragw-user":"ragw-bot"}`,$(s,a),r.length){const n=document.createElement("div");n.className="ragw-sources",n.textContent=`Sources: ${r.map(i=>i.documentName).filter(Boolean).join(", ")}`,s.appendChild(n)}if(e!=="user"&&o.length){const n=document.createElement("div");n.className="ragw-suggestions";for(const i of o){const d=document.createElement("button");d.type="button",d.className="ragw-suggestion",d.textContent=i.label,d.addEventListener("click",()=>{var l;n.querySelectorAll("button").forEach(m=>{m.disabled=!0}),(l=t==null?void 0:t.onSuggestion)==null||l.call(t,i.message,i.label)}),n.appendChild(d)}s.appendChild(n)}if(e!=="user"&&(t!=null&&t.showFeedback)&&o.length===0){const n=document.createElement("div");n.className="ragw-feedback",n.appendChild(document.createTextNode("Was this helpful?"));for(const[i,d]of[["helpful","👍 Yes"],["not_helpful","👎 No"]]){const l=document.createElement("button");l.type="button",l.textContent=d,l.addEventListener("click",async()=>{n.querySelectorAll("button").forEach(m=>m.classList.remove("ragw-selected")),l.classList.add("ragw-selected"),await t.onFeedback(i)}),n.appendChild(l)}s.appendChild(n)}return s}function C(){const e=document.createElement("div");return e.className="ragw-msg ragw-bot ragw-typing",e.setAttribute("aria-label","Assistant is typing"),e.innerHTML='<span class="ragw-dot"></span><span class="ragw-dot"></span><span class="ragw-dot"></span>',e}async function N(e,a,r,{isSuggestion:t=!1}={}){const o=await fetch(`${e.apiBaseUrl}/widget/companies/${e.companyId}/chat`,{method:"POST",headers:{"Content-Type":"application/json","X-Widget-API-Key":e.apiKey},body:JSON.stringify({message:a,sessionId:r,customerName:e.customerName||"",customerEmail:e.customerEmail||"",customerPhone:e.customerPhone||"",isSuggestion:t})}),s=await o.json();if(!o.ok)throw new Error(s.error||"Chat request failed");return s}async function q(e,a){const r=await fetch(`${e.apiBaseUrl}/widget/companies/${e.companyId}/chat/history/${encodeURIComponent(a)}`,{headers:{"X-Widget-API-Key":e.apiKey}}),t=await r.json();if(!r.ok)throw new Error(t.error||"Chat history request failed");return t}async function v(e,a,r){a&&await fetch(`${e.apiBaseUrl}/widget/companies/${e.companyId}/chat/feedback`,{method:"POST",headers:{"Content-Type":"application/json","X-Widget-API-Key":e.apiKey},body:JSON.stringify({conversationId:a,feedback:r})})}function x(e={}){const a={...S,...window.RAG_CHAT_WIDGET,...e};if(!a.companyId){console.error("[RAG Widget] companyId is required");return}T(a);const r=I(a.companyId),t=document.createElement("div");t.className="ragw-root",t.innerHTML=`
    <section class="ragw-panel">
      <header class="ragw-header">
        <div class="ragw-header-copy">
          <p class="ragw-title"></p>
          <p class="ragw-subtitle"></p>
        </div>
        <button class="ragw-close" type="button" aria-label="Close chat">&times;</button>
      </header>
      <div class="ragw-messages"></div>
      <form class="ragw-form">
        <input class="ragw-input" type="text" placeholder="Type your question" autocomplete="off" />
        <button class="ragw-send" type="submit">Send</button>
      </form>
    </section>
    <button class="ragw-button" type="button" aria-label="Open chat">${A(a.launcherIcon)}</button>
  `,t.querySelector(".ragw-title").textContent=a.title,t.querySelector(".ragw-subtitle").textContent=a.subtitle;const o=t.querySelector(".ragw-messages"),s=t.querySelector(".ragw-input"),n=t.querySelector(".ragw-form"),i=t.querySelector(".ragw-send"),d=t.querySelector(".ragw-button"),l=t.querySelector(".ragw-close");let m=!1;s.disabled=!0,i.disabled=!0;async function E(c,u=c,{isSuggestion:b=!1}={}){if(!c||!m)return;s.value="",o.appendChild(h("user",u)),o.scrollTop=o.scrollHeight,i.disabled=!0;const p=C();o.appendChild(p),o.scrollTop=o.scrollHeight;try{const g=await N(a,c,r,{isSuggestion:b});p.remove(),o.appendChild(h("bot",g.answer,g.sources||[],{showFeedback:a.showFeedback,onFeedback:w=>v(a,g.conversationId,w),onSuggestion:(w,F)=>E(w,F,{isSuggestion:!0})},g.suggestions||[]))}catch(g){p.remove(),o.appendChild(h("bot",g.message||"Unable to send message."))}finally{i.disabled=!1,o.scrollTop=o.scrollHeight}}d.addEventListener("click",()=>t.classList.toggle("ragw-open")),l.addEventListener("click",()=>t.classList.remove("ragw-open")),n.addEventListener("submit",async c=>{c.preventDefault(),await E(s.value.trim())}),document.body.appendChild(t);async function L(){const c=C();o.appendChild(c);try{const u=await q(a,r);c.remove();const b=Array.isArray(u.messages)?u.messages:[];if(!b.length){o.appendChild(h("bot",a.greeting||"Hi, how can I help?"));return}for(const p of b){const g=p.role==="assistant";o.appendChild(h(p.role,p.content,p.sources||[],g?{showFeedback:a.showFeedback,onFeedback:w=>v(a,u._id,w)}:null))}}catch(u){c.remove(),console.warn("[RAG Widget] Unable to restore chat history",u),o.appendChild(h("bot","I couldn't load your earlier messages, but you can start a new chat here."))}finally{m=!0,s.disabled=!1,i.disabled=!1,o.scrollTop=o.scrollHeight}}L()}window.RAGChatWidget={init:x},((k=window.RAG_CHAT_WIDGET)==null?void 0:k.autoInit)!==!1&&(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>x()):x())})();
