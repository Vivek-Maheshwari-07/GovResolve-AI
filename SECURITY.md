# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately through GitHub's
"Report a vulnerability" button on the Security tab of this repository, or contact the maintainers directly. Include what you
found, how to reproduce it, and the impact you expect. We will acknowledge within a few days.

## Running the service safely

- **Admin token.** `GOV_ADMIN_TOKEN` is empty by default, which is fine on `localhost` only. Anyone who can reach an unprotected
  server can add documents that change lineage statuses and trigger rebuilds. Set a long random token before exposing the
  server beyond your own machine (the Docker Compose file refuses to start without one).
- **API keys.** Keep `GROQ_API_KEY`, `LLM_API_KEY` and `GOOGLE_API_KEY` in `.env`, which is git-ignored. Keys are sent only in the
  `Authorization` header and are redacted from log output. Never paste a key into an issue, a pull request or a chat.
- **Data sent to hosted providers.** With Groq (or any hosted provider) the question and the retrieved passages leave your
  machine. Use Ollama when the documents must stay on-premises.
- **Exposure.** Run behind HTTPS (a reverse proxy) if the server is shared. Set `GOV_CORS_ORIGINS` to your own origin.
  The built-in rate limit counts per socket address, so behind a proxy configure rate limiting at the proxy as well.
- **Files.** The PDF route finds files by the stored file name only; requests cannot choose a path.

## Supported versions

Security fixes go to the latest release on `main`.
