(function(){"use strict";var c;const u={apiBaseUrl:"http://localhost:3000",companyId:"",title:"Support Chat",subtitle:"Ask from our knowledge base",accentColor:"#111827",position:"right",apiKey:""};function g(t){const o=`rag_widget_session_${t}`;let a=localStorage.getItem(o);return a||(a=`web_${crypto.randomUUID()}`,localStorage.setItem(o,a)),a}function m(t){const o=document.createElement("style"),a=t.position==="left"?"left":"right";o.textContent=`
    .ragw-root{position:fixed;${a}:20px;bottom:20px;z-index:2147483000;font-family:Inter,system-ui,-apple-system,Segoe UI,Arial,sans-serif;color:#172033}
    .ragw-button{width:58px;height:58px;border:0;border-radius:999px;background:${t.accentColor};color:#fff;box-shadow:0 18px 45px rgba(15,23,42,.28);cursor:pointer;font-size:24px}
    .ragw-panel{display:none;width:min(380px,calc(100vw - 32px));height:min(620px,calc(100vh - 104px));margin-bottom:14px;border:1px solid #d9e0ea;border-radius:10px;background:#fff;box-shadow:0 24px 70px rgba(15,23,42,.24);overflow:hidden}
    .ragw-open .ragw-panel{display:flex;flex-direction:column}
    .ragw-header{background:${t.accentColor};color:#fff;padding:14px 16px}
    .ragw-title{font-size:15px;font-weight:800;margin:0}
    .ragw-subtitle{font-size:12px;opacity:.82;margin:3px 0 0}
    .ragw-messages{flex:1;overflow:auto;padding:14px;background:#f6f8fb}
    .ragw-msg{max-width:86%;padding:10px 12px;margin:0 0 10px;border-radius:9px;font-size:14px;line-height:1.45;white-space:pre-wrap}
    .ragw-user{margin-left:auto;background:${t.accentColor};color:#fff}
    .ragw-bot{background:#fff;border:1px solid #e1e7ef;color:#172033}
    .ragw-sources{margin-top:8px;border-top:1px solid #e6ebf2;padding-top:7px;font-size:11px;color:#64748b}
    .ragw-form{display:flex;gap:8px;padding:12px;border-top:1px solid #e1e7ef;background:#fff}
    .ragw-input{flex:1;min-width:0;height:40px;border:1px solid #cbd5e1;border-radius:7px;padding:0 10px;font-size:14px;outline:none}
    .ragw-send{height:40px;border:0;border-radius:7px;background:${t.accentColor};color:#fff;padding:0 14px;font-weight:700;cursor:pointer}
    .ragw-send:disabled{opacity:.55;cursor:not-allowed}
  `,document.head.appendChild(o)}function n(t,o,a=[]){const e=document.createElement("div");if(e.className=`ragw-msg ${t==="user"?"ragw-user":"ragw-bot"}`,e.textContent=o,a.length){const r=document.createElement("div");r.className="ragw-sources",r.textContent=`Sources: ${a.map(s=>s.documentName).filter(Boolean).join(", ")}`,e.appendChild(r)}return e}async function f(t,o,a){const e=await fetch(`${t.apiBaseUrl}/widget/companies/${t.companyId}/chat`,{method:"POST",headers:{"Content-Type":"application/json","X-Widget-API-Key":t.apiKey},body:JSON.stringify({message:o,sessionId:a,customerName:t.customerName||"",customerEmail:t.customerEmail||"",customerPhone:t.customerPhone||""})}),r=await e.json();if(!e.ok)throw new Error(r.error||"Chat request failed");return r}function d(t={}){const o={...u,...window.RAG_CHAT_WIDGET,...t};if(!o.companyId){console.error("[RAG Widget] companyId is required");return}m(o);const a=g(o.companyId),e=document.createElement("div");e.className="ragw-root",e.innerHTML=`
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
    <button class="ragw-button" type="button" aria-label="Open chat">?</button>
  `,e.querySelector(".ragw-title").textContent=o.title,e.querySelector(".ragw-subtitle").textContent=o.subtitle;const r=e.querySelector(".ragw-messages"),s=e.querySelector(".ragw-input"),w=e.querySelector(".ragw-form"),p=e.querySelector(".ragw-send"),x=e.querySelector(".ragw-button");r.appendChild(n("bot","Hi, how can I help?")),x.addEventListener("click",()=>e.classList.toggle("ragw-open")),w.addEventListener("submit",async b=>{b.preventDefault();const l=s.value.trim();if(l){s.value="",r.appendChild(n("user",l)),r.scrollTop=r.scrollHeight,p.disabled=!0;try{const i=await f(o,l,a);r.appendChild(n("bot",i.answer,i.sources||[]))}catch(i){r.appendChild(n("bot",i.message||"Unable to send message."))}finally{p.disabled=!1,r.scrollTop=r.scrollHeight}}}),document.body.appendChild(e)}window.RAGChatWidget={init:d},((c=window.RAG_CHAT_WIDGET)==null?void 0:c.autoInit)!==!1&&(document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>d()):d())})();
