# Embeddable Chat Widget

Build the widget:

```powershell
npm.cmd run build:widget
```

Output:

```text
frontend/dist-widget/rag-chat-widget.iife.js
```

Host that file somewhere public, then paste this into any company website:

```html
<script>
  window.RAG_CHAT_WIDGET = {
    apiBaseUrl: "http://localhost:3000",
    companyId: "PASTE_COMPANY_ID",
    apiKey: "PASTE_WIDGET_API_KEY",
    title: "Support Chat",
    subtitle: "Ask us anything",
    accentColor: "#111827",
    position: "right"
  };
</script>
<script src="http://localhost:5173/dist-widget/rag-chat-widget.iife.js"></script>
```

For production, replace `apiBaseUrl` and `script src` with your deployed backend and widget URLs.

The widget stores an anonymous browser session id in `localStorage`, so repeat visits from the same browser continue the same chat session.
