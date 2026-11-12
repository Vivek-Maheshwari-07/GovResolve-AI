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
| `npm test` | Unit tests for the API client and helper libraries |

## Structure

| Path | Contents |
|---|---|
| `src/api.js` | API client; reshapes responses for the components |
| `src/App.jsx` | Layout, routing between landing, answer and library views |
| `src/components/` | Answer card, PDF inspector, lineage graph, library, tour, Gujarati keyboard |
| `src/pages/` | Landing page and its sections |
| `src/lib/` | Status mapping, lineage helpers, sample questions |

## Notes

- The UI never shows an "active" status. Statuses are `superseded`, `amended`, `no later amendment found` or `unknown`.
- In production the app and API share one origin, so no CORS setup is needed.
- Styling uses Tailwind CSS; PDF rendering uses `pdfjs-dist`.
