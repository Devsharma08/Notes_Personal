# 📝 NoteFlow

A local-first notes application with rich note-taking features: titles, descriptions, bullet pointers, text highlighting, pinning, colors, search, and grid/list views. The frontend is powered by [Vite](https://vite.dev) and uses [json-server](https://github.com/typicode/json-server) for local development.

---

## Features

- **Create & edit notes** — title, description, bullet pointers, and note color
- **Text highlighting** — mark specific words/phrases in yellow throughout each note
- **Bullet pointers** — add structured bullet-point lists to any note
- **Pin notes** — pin important notes to keep them at the top
- **Note colors** — color-code notes with 8 pastel themes
- **Search** — live full-text search across title, description, pointers, and highlights
- **Grid / List view** — toggle between card grid and compact list layouts
- **Live preview** — see highlights applied in real-time while editing
- **Local JSON database** — notes are stored in `db.json` through json-server during local development
- **Encryption utilities** — AES-256-GCM encryption and PBKDF2 key derivation are provided in `src/crypto.js`
- **Optional serverless API** — `api/notes.js` stores encrypted payloads in Upstash Redis for a Vercel deployment

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v16 or higher
- [pnpm](https://pnpm.io/) (or npm)

### Install

```bash
git clone <your-repo-url>
cd notes-app
pnpm install
```

### Initialize the database

Create a `db.json` file in the project root:

```bash
cp db.example.json db.json
```

You can replace the sample data with an empty database if preferred:

```json
{"notes": []}
```

### Run

```bash
pnpm start
```

This starts two servers concurrently:

| Server | URL | Purpose |
|--------|-----|---------|
| Vite dev server | http://localhost:3000 | Frontend (hot-reload) |
| json-server | http://localhost:3001 | REST API / local database |

Open **http://localhost:3000** in your browser.

---

## Project Structure

```
notes-app/
├── src/
│   ├── main.js        # App logic, rendering, event handling
│   ├── api.js         # Local notes API calls
│   ├── crypto.js      # AES-GCM encryption/decryption helpers
│   ├── crypto.test.js # Encryption round-trip and password rejection test
│   ├── utils.js       # Highlight engine, date formatting, helpers
│   └── styles.css     # All styles (design tokens, components)
├── api/
│   └── notes.js       # Optional Vercel/Upstash encrypted notes API
├── index.html         # HTML entry point
├── vite.config.js     # Vite config (proxies /api → json-server)
├── package.json       # Scripts and dependencies
├── db.example.json    # Sample database (committed)
├── db.json            # Your local database (gitignored)
└── .gitignore
```

---

## Local API

The browser talks to `/api/notes`. During local development, Vite proxies these requests to json-server at `http://localhost:3001`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/notes` | Get all notes |
| `POST` | `/api/notes` | Create a note |
| `PUT` | `/api/notes/:id` | Update a note |
| `DELETE` | `/api/notes/:id` | Delete a note |

## Optional Vercel API

`api/notes.js` is a separate serverless handler for deployments that use [Vercel](https://vercel.com/) and [Upstash Redis](https://upstash.com/). It accepts encrypted note payloads and supports `GET`, `POST`, and `DELETE`; it does not replace the local json-server workflow automatically.

The optional handler requires the `@upstash/redis` package and Upstash REST credentials in the deployment environment. Install the package before deploying this route:

```bash
pnpm add @upstash/redis
```

Configure the Upstash integration variables required by `@upstash/redis`, plus:

| Variable | Purpose |
|----------|---------|
| `REDIS_STORAGE_KEY` | Optional Redis key; defaults to `encrypted_noteflow_db` |
| `VITE_APP_SECRET_KEY` or `APP_SECRET_KEY` | Optional value checked against the `x-noteflow-secret` request header |

The serverless handler expects `POST` requests with an `encryptedNote` containing `id` and `ciphertext`. The encryption helpers use AES-256-GCM with a PBKDF2-derived key, a random 16-byte salt, and a random 12-byte IV. The current frontend does not yet call this handler or encrypt notes automatically.

---

## Note Schema

```json
{
  "id": "unique-string-id",
  "title": "Note Title",
  "description": "Full note body text.",
  "pointers": ["First bullet point", "Second bullet point"],
  "highlights": ["word1", "phrase to highlight"],
  "color": "#fef9c3",
  "pinned": false,
  "createdAt": "2026-09-17T10:00:00.000Z",
  "updatedAt": "2026-09-17T10:00:00.000Z"
}
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm start` | Start both frontend and json-server |
| `pnpm dev` | Start both frontend and json-server |
| `pnpm server` | Start only json-server on port 3001 |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview the production build |
| `pnpm test` | Run the encryption round-trip test |

---

## .gitignore Notes

The following are intentionally excluded from version control:

- `db.json` — your local notes data (personal/private)
- `node_modules/` — install with `pnpm install`
- `dist/` — generated by `pnpm build`

To share sample data, edit `db.example.json` instead.
