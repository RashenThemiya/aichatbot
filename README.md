# Multi-Tenant RAG Chatbot

A multi-company RAG (Retrieval-Augmented Generation) customer support system. Each company uploads PDF knowledge-base documents, and customers can ask questions through web chat, WhatsApp, or SMS. Answers are grounded only in the selected company's documents.

## Current features

- Multi-company admin dashboard
- Company admin and superadmin access
- PDF upload and per-company vector indexing
- Web chat widget with guest mode, Google login, and website-account login
- Persistent chat history for web, WhatsApp, and SMS users
- WhatsApp Cloud API integration per company
- SMS chatbot integration through Twilio per company
- Small-talk handling and query rewriting before RAG search
- Conversation storage in MongoDB
- ChromaDB vector collections isolated per company

## Architecture

```text
┌─────────────────────┐
│ Admin Dashboard      │
│ Company Website      │
│ Web Chat Widget      │
│ WhatsApp Customer    │
│ SMS Customer         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Node.js API          │
│ Express Backend      │
│ Auth + Integrations  │
│ Chat + Webhooks      │
└──────────┬──────────┘
           │
           ├──────────────► MongoDB
           │                 Companies, documents,
           │                 integrations, conversations,
           │                 SMS logs
           │
           └──────────────► Python RAG Service
                             FastAPI + ChromaDB + OpenAI
```

| Component | Role |
|-----------|------|
| `frontend/` | React admin dashboard and widget embed generator |
| `backend/` | Express API, authentication, company management, integrations, chat, webhooks |
| `rag-service/` | PDF parsing, chunking, embeddings, vector search, LLM answers |
| MongoDB | Stores users, companies, documents, integrations, conversations, SMS logs |
| ChromaDB | Stores vector indexes per company |
| Meta WhatsApp Cloud API | WhatsApp customer messages |
| Twilio Programmable Messaging | SMS customer messages |

## Prerequisites

- Node.js 18+
- Python 3.11+
- MongoDB running locally or MongoDB Atlas URI
- OpenAI API key
- Meta WhatsApp Cloud API account for WhatsApp integration
- Twilio account for SMS integration

## Setup

### 1. Python RAG service

```bash
cd rag-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Set your OpenAI key in `rag-service/.env`.

Start the RAG service:

```bash
uvicorn app.main:app --reload --port 8000
```

RAG service: `http://localhost:8000`  
RAG API docs: `http://localhost:8000/docs`

### 2. Node.js backend

```bash
cd backend
npm install
npm install google-auth-library twilio
copy .env.example .env
```

Start the backend:

```bash
npm run dev
```

Backend: `http://localhost:3000`

### 3. Frontend admin dashboard

```bash
cd frontend
npm install
npm run dev
```

### 4. Build web chat widget

```powershell
cd frontend
npm.cmd run build:widget
```

Output:

```text
frontend/dist-widget/rag-chat-widget.iife.js
```

## Backend environment variables

Add these values to `backend/.env`.

| Variable | Example / Default | Description |
|----------|-------------------|-------------|
| `PORT` | `3000` | Backend API port |
| `MONGODB_URI` | `mongodb://localhost:27017/rag_chatbot` | MongoDB connection string |
| `RAG_SERVICE_URL` | `http://localhost:8000` | Python RAG service URL |
| `UPLOAD_DIR` | `./uploads` | Uploaded PDF storage folder |
| `JWT_SECRET` | long random secret | Admin JWT signing secret and hashing salt |
| `SUPER_ADMIN_EMAIL` | `admin@example.com` | Seeded superadmin email |
| `SUPER_ADMIN_PASSWORD` | `admin123` | Seeded superadmin password |
| `GOOGLE_CLIENT_IDS` | Google OAuth client ID | Comma-separated Google Client IDs for widget Google login |
| `OPENAI_API_KEY` | OpenAI key | Used by message preprocessing / query rewriting |
| `OPENAI_CHAT_MODEL` | `gpt-4o-mini` | Model used for query rewrite / intent classification |
| `GRAPH_API_VERSION` | `v20.0` | Meta Graph API version |
| `WHATSAPP_VERIFY_TOKEN` | custom verify token | Used for Meta WhatsApp webhook verification |
| `WHATSAPP_TOKEN_ENCRYPTION_KEY` | long random secret | Encrypts company WhatsApp access tokens |
| `SMS_TOKEN_ENCRYPTION_KEY` | long random secret | Encrypts company Twilio Auth Tokens |
| `PUBLIC_BACKEND_URL` | `https://api.yourdomain.com` | Public backend URL shown in integration pages and used for callbacks |
| `TWILIO_VALIDATE_WEBHOOK_SIGNATURE` | `true` | Enables Twilio webhook signature validation |

For local SMS webhook testing with ngrok, you can temporarily use:

```env
TWILIO_VALIDATE_WEBHOOK_SIGNATURE=false
PUBLIC_BACKEND_URL=https://your-ngrok-url.ngrok-free.app
```

Use `TWILIO_VALIDATE_WEBHOOK_SIGNATURE=true` in production.

## RAG service environment variables

Add these values to `rag-service/.env`.

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | - | Required OpenAI key |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Embeddings model |
| `OPENAI_CHAT_MODEL` | `gpt-4o-mini` | Chat model |
| `CHROMA_PERSIST_DIR` | `./chroma_data` | Vector DB path |
| `CHUNK_SIZE` | `1000` | Characters per chunk |
| `CHUNK_OVERLAP` | `200` | Overlap between chunks |
| `TOP_K` | `5` | Retrieved chunks per query |

## Web chat widget identity and history

The web widget supports three customer modes.

| Mode | How identity is created | History behavior |
|------|--------------------------|------------------|
| Website account login | Company website backend returns a signed external user token | Loads previous history for the same website user ID |
| Google login | Widget sends Google ID token to backend and backend verifies it | Loads previous history for the same Google account |
| Guest mode | Widget creates `web_guest_<uuid>` and stores it in browser `localStorage` | Loads previous history only in the same browser |

The backend converts identities into stable session IDs:

```text
Website account: web_external_<hash>
Google account:  web_google_<hash>
Guest browser:   web_guest_<uuid>
```

The public widget routes are protected with the widget API key.

### Widget public routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/widget/companies/:companyId/chat` | Send web widget message |
| `GET` | `/widget/companies/:companyId/chat/history/:sessionId` | Load web widget chat history |
| `POST` | `/widget/companies/:companyId/chat/auth/google` | Verify Google login and return chatbot session |
| `POST` | `/widget/companies/:companyId/chat/auth/external` | Verify company website user token and return chatbot session |

## API usage

### Health check

```bash
curl http://localhost:3000/health
```

### Create company

```bash
curl -X POST http://localhost:3000/api/companies \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Acme Support\", \"description\": \"Acme customer help\"}"
```

Save the returned `_id` as `COMPANY_ID`.

### Upload PDF

```bash
curl -X POST http://localhost:3000/api/companies/COMPANY_ID/documents \
  -F "file=@path/to/your-faq.pdf"
```

### List documents

```bash
curl http://localhost:3000/api/companies/COMPANY_ID/documents
```

### Chat from admin/API

```bash
curl -X POST http://localhost:3000/api/companies/COMPANY_ID/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"How do I reset my password?\"}"
```

Response includes `answer`, `sources`, and `sessionId`.

Follow-up message:

```bash
curl -X POST http://localhost:3000/api/companies/COMPANY_ID/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"What are your support hours?\", \"sessionId\": \"SESSION_ID_FROM_PREVIOUS\"}"
```

### View chat history as admin

```bash
curl http://localhost:3000/api/companies/COMPANY_ID/chat/conversations
curl http://localhost:3000/api/companies/COMPANY_ID/chat/history/SESSION_ID
```

### Delete document

```bash
curl -X DELETE http://localhost:3000/api/companies/COMPANY_ID/documents/DOCUMENT_ID
```

## WhatsApp integration

Each company can save its own Meta WhatsApp Cloud API credentials. The access token is encrypted before it is stored in MongoDB.

### Save WhatsApp integration

```bash
curl -X POST http://localhost:3000/api/companies/COMPANY_ID/whatsapp-integration \
  -H "Content-Type: application/json" \
  -d "{\"phoneNumberId\": \"1175322778994139\", \"accessToken\": \"META_ACCESS_TOKEN\", \"isActive\": true}"
```

### Manage WhatsApp integration

```bash
curl http://localhost:3000/api/companies/COMPANY_ID/whatsapp-integration

curl -X PUT http://localhost:3000/api/companies/COMPANY_ID/whatsapp-integration \
  -H "Content-Type: application/json" \
  -d "{\"isActive\": true}"

curl -X POST http://localhost:3000/api/companies/COMPANY_ID/whatsapp-integration/validate

curl -X DELETE http://localhost:3000/api/companies/COMPANY_ID/whatsapp-integration
```

### WhatsApp manual send

```bash
curl -X POST http://localhost:3000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d "{\"companyId\": \"COMPANY_ID\", \"to\": \"94771234567\", \"text\": \"Hello from the support chatbot\"}"
```

### WhatsApp webhook setup

Use these endpoints in Meta webhook configuration:

```text
GET  /api/whatsapp/webhook
POST /api/whatsapp/webhook
```

Incoming WhatsApp messages are matched to a company by the Meta `phone_number_id`. The conversation session ID uses:

```text
whatsapp:<customerWaId>
```

## SMS integration

Each company can save its own Twilio Programmable Messaging credentials. The Twilio Auth Token is encrypted before it is stored in MongoDB.

### Save SMS integration

```bash
curl -X POST http://localhost:3000/api/companies/COMPANY_ID/sms-integration \
  -H "Content-Type: application/json" \
  -d "{\"accountSid\": \"ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\", \"authToken\": \"TWILIO_AUTH_TOKEN\", \"phoneNumber\": \"+14165550100\", \"isActive\": true}"
```

### Manage SMS integration

```bash
curl http://localhost:3000/api/companies/COMPANY_ID/sms-integration

curl -X PUT http://localhost:3000/api/companies/COMPANY_ID/sms-integration \
  -H "Content-Type: application/json" \
  -d "{\"isActive\": true}"

curl -X POST http://localhost:3000/api/companies/COMPANY_ID/sms-integration/validate

curl -X DELETE http://localhost:3000/api/companies/COMPANY_ID/sms-integration
```

### SMS manual send

```bash
curl -X POST http://localhost:3000/api/sms/send \
  -H "Content-Type: application/json" \
  -d "{\"companyId\": \"COMPANY_ID\", \"to\": \"+14165550123\", \"text\": \"Hello from the SMS chatbot\"}"
```

### Twilio webhook setup

Configure these URLs in the Twilio phone number messaging settings:

```text
Incoming SMS Webhook:
POST https://your-backend-domain.com/api/sms/webhook

Status Callback:
POST https://your-backend-domain.com/api/sms/status
```

For local testing with ngrok:

```text
POST https://your-ngrok-url.ngrok-free.app/api/sms/webhook
POST https://your-ngrok-url.ngrok-free.app/api/sms/status
```

Incoming SMS messages are matched to a company by the Twilio `To` number. The conversation session ID uses:

```text
sms:<customerPhoneNumber>
```

## API endpoints summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Backend + RAG health |
| `POST` | `/api/auth/login` | Admin login |
| `GET` | `/api/auth/me` | Current admin user |
| `POST` | `/api/companies` | Create company |
| `GET` | `/api/companies` | List companies |
| `GET/PUT/DELETE` | `/api/companies/:id` | Get, update, delete company |
| `POST` | `/api/companies/:id/widget-api-key` | Generate/rotate widget API key |
| `POST` | `/api/companies/:id/documents` | Upload PDF |
| `GET` | `/api/companies/:id/documents` | List documents |
| `DELETE` | `/api/companies/:id/documents/:docId` | Delete PDF and vectors |
| `POST` | `/api/companies/:id/documents/:docId/reindex` | Re-index PDF |
| `POST` | `/api/companies/:id/chat` | Ask question from admin/API |
| `GET` | `/api/companies/:id/chat/conversations` | List conversations |
| `GET` | `/api/companies/:id/chat/history/:sessionId` | Full conversation |
| `POST` | `/widget/companies/:companyId/chat` | Public web widget chat |
| `GET` | `/widget/companies/:companyId/chat/history/:sessionId` | Public widget history |
| `POST` | `/widget/companies/:companyId/chat/auth/google` | Widget Google login |
| `POST` | `/widget/companies/:companyId/chat/auth/external` | Widget website-account login |
| `POST` | `/api/companies/:id/whatsapp-integration` | Create WhatsApp integration |
| `GET/PUT/DELETE` | `/api/companies/:id/whatsapp-integration` | Manage WhatsApp integration |
| `POST` | `/api/companies/:id/whatsapp-integration/validate` | Validate WhatsApp integration |
| `GET` | `/api/whatsapp/webhook` | Verify Meta WhatsApp webhook |
| `POST` | `/api/whatsapp/webhook` | Receive WhatsApp webhook messages |
| `POST` | `/api/whatsapp/send` | Send WhatsApp text message |
| `POST` | `/api/companies/:id/sms-integration` | Create SMS integration |
| `GET/PUT/DELETE` | `/api/companies/:id/sms-integration` | Manage SMS integration |
| `POST` | `/api/companies/:id/sms-integration/validate` | Validate SMS integration |
| `POST` | `/api/sms/webhook` | Receive Twilio inbound SMS |
| `POST` | `/api/sms/status` | Receive Twilio message status callback |
| `POST` | `/api/sms/send` | Send SMS text message |

## Python RAG service endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service health |
| `POST` | `/ingest` | Index a PDF |
| `DELETE` | `/documents` | Remove document vectors |
| `POST` | `/query` | RAG Q&A |

## Multi-tenancy

- Each company gets an isolated ChromaDB collection named `company_{id}`.
- All RAG queries include `company_id`.
- Company A cannot access Company B documents or conversations.
- Uploaded PDFs are stored under `backend/uploads/{companyId}/`.
- WhatsApp integrations are matched by Meta `phone_number_id`.
- SMS integrations are matched by Twilio `To` phone number.
- Web widget history is matched by `companyId + sessionId`.

## Conversation session IDs

| Channel | Session ID pattern |
|---------|--------------------|
| Web guest | `web_guest_<uuid>` |
| Web Google | `web_google_<hash>` |
| Web website-account | `web_external_<hash>` |
| WhatsApp | `whatsapp:<waId>` |
| SMS | `sms:<phoneNumber>` |
| Admin chat test | custom session ID or generated session ID |

## Testing order

1. Start MongoDB.
2. Start the RAG service.
3. Start the backend.
4. Start the admin frontend.
5. Create a company.
6. Upload at least one PDF.
7. Test normal admin chat.
8. Generate widget API key and test guest web history.
9. Test Google login and website-account login if configured.
10. Save and validate WhatsApp integration.
11. Save and validate SMS integration.
12. Configure public webhook URLs in Meta and Twilio.

## Future phases

- Voice call integration
- AWS S3 file storage
- Advanced analytics dashboard
- Delivery status dashboard for SMS/WhatsApp
- Human handoff / live agent escalation
