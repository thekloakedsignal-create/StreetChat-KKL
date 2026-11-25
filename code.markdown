# StreetChat

A RAG companion chatbot for people experiencing (or recently out of) homelessness
in Orange County, CA — and for the case managers who walk with them.

Two companions, one server:
- **Client che** — a friend and system navigator for daily life on the street.
- **Case Manager consult** — a professional tool: verified resources, referral
  strategy, documentation checklists.

The two personas are **hard-isolated** — separate prompt files, and separate
**journals** (long-term memory) scoped by role. A client's reflection history
never appears in a case manager's working notes.

## What's inside

- **FastAPI backend**: auth, chat orchestration, memory, SMS, admin review
- **Hybrid RAG**: pgvector (dense) + Postgres FTS (sparse), fused with RRF,
  over **verified-only** resources
- **Journals**: two-layer memory — rolling summary + session entries — filtered
  by `(user_id, role)`
- **Web UI**: mobile-first single-page chat at `static/index.html` (no
  build step); anonymous-first (no account needed); PINless recovery via a
  personal question; image upload for the vision-capable model
- **SMS**: full chat via Twilio webhook (JOIN/UNLINK flows, media attachment
  support, per-phone token-bucket rate limiting)
- **Growth agent**: scheduled web searches → `resource_candidates` table.
  **Nothing goes user-visible until a human approves it** in the admin queue
- **Crisis scaffolding**: deterministic risk scoring surfaces hotline context
  and crisis-styled responses. The one **hard** rail, inherited from the core
  contract: **never fabricate resources**

## Trust architecture (the part that matters)

| Surfaces to users | Guardrail |
|---|---|
| **Resources (ground truth)** | `verified=True` only; candidates quarantined until human approval |
| **Conversational safety** | Owned by the fine-tuned model, not system-prompt lectures |
| **Crisis moments** | Deterministic risk scoring + hotline context — deterministic beats persuasive |

## Quick start (local)