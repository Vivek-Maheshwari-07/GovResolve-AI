# SFIC project: instructions for AI coding tools

Project: Gujarati-English assistant for Government Resolutions (PS000230), Seva First Innovation Challenge.
This repo currently holds Squad 3's backend (API + amendment/supersession lineage graph) in `backend/`.

Before changing anything, read `backend/IMPLEMENTATION_PLAN.md` (context, code map, rules, task list).
API contract shared with other squads: `backend/API_CONTRACT.md`. Original docs: `docs/`.

Hard rules: edge direction is newer -> older; never output an "active" status; only explicit references create edges;
quotes are verbatim; do not rename or remove existing API fields (frozen after Nov 2); add tests and run
`python -m pytest` from `backend/` before finishing.
