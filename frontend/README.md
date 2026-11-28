# GovResolve-AI web app

A React 18 and Vite single-page app for asking questions about Government Resolutions. It shows the answer, verbatim citations, the original PDF with the cited passage boxed, and the amendment lineage.

## Run

```bash
cd frontend
npm ci
npm run dev        # http://localhost:3000, proxies API calls to http://localhost:8000
```

Start the backend first (`python run.py` from the repository root, or see [../backend/README.md](../backend/README.md)).

| Command | Purpose |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build into `dist/` (the API serves it at `/`) |
| `npm run preview` | Serve the production build locally |
| `npm test` | Unit tests for the API client, translations, status logic and the voice helpers |

## Structure

| Path | Contents |
|---|---|
| `src/api.js` | API client; reshapes responses for the components |
| `src/App.jsx` | Layout, routing between landing, answer and library views |
| `src/components/` | Answer card, chat and voice assistant, PDF inspector, lineage graph, library, tour, Gujarati keyboard |
| `src/pages/` | Landing page (`Hero.jsx`, `hero/` sections and motion pieces) and the `/admin` page |
| `src/lib/` | Status mapping, lineage helpers, translations; `endpointing.js` and `speechSession.js` decide when speech has ended, `replyVoice.js` reads replies aloud |

## Notes

- The UI never shows an "active" status. Statuses are `superseded`, `amended`, `no later amendment found` or `unknown`.
- The PDF viewer, lineage graph, library, method page and admin page are loaded on first use, so the first screen stays small.
- Animations follow `prefers-reduced-motion`.
- In production the app and API share one origin, so no CORS setup is needed.
- Styling uses Tailwind CSS; PDF rendering uses `pdfjs-dist`.
