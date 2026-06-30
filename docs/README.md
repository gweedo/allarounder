# Allarounder — Documentation

Documentation for the **Allarounder** project: a written-articles blog (Italian) that promotes a podcast hosted on Spotify. Built in Python on Azure.

## Structure

```
docs/
├── README.md                     # this index
├── DECISIONS.md                  # decision log (source of truth for choices made)
├── architecture/
│   ├── TECH-SPEC.md              # technical specification (how it's built & run)
│   ├── SITE-STRUCTURE.md         # sitemap, data models, API surface, SEO
│   └── adr/                      # Architecture Decision Records
│       ├── README.md             #   ADR index
│       └── NNNN-*.md             #   one decision per file
└── product/
    ├── PRD.md                          # product requirements (vision, audience, goals, scope)
    └── content-team-questionnaire.md   # input questionnaire for the writers (PRD source)
```

## Start here

| If you want to… | Read |
|---|---|
| **Run the project locally** | [local-dev.md](local-dev.md) |
| Understand the product (vision, audience, goals, scope) | [product/PRD.md](product/PRD.md) |
| Understand *what* was decided and *why* | [DECISIONS.md](DECISIONS.md) |
| Understand *how* the system is built | [architecture/TECH-SPEC.md](architecture/TECH-SPEC.md) |
| See pages, data models, API, SEO | [architecture/SITE-STRUCTURE.md](architecture/SITE-STRUCTURE.md) |
| Read the rationale behind a specific choice | [architecture/adr/README.md](architecture/adr/README.md) |
| Give the writers their input form | [product/content-team-questionnaire.md](product/content-team-questionnaire.md) |

## Decision summary (v1)

- **Language/stack:** Python · FastAPI (headless JSON API) · Next.js frontend (SSR/ISR) · custom admin UI
- **Architecture:** pragmatic Domain-Driven Design · Test-Driven Development
- **Data:** Azure Database for PostgreSQL · Azure Blob Storage (images) · article bodies in Markdown
- **Hosting:** Azure Container Apps · Bicep IaC · separate staging + production · region Italy North
- **Delivery:** GitHub monorepo (`src/backend`, `src/frontend`) · GitHub Actions (path-filtered) · OIDC to Azure
- **Observability:** OpenTelemetry → Azure Monitor / Application Insights · structured JSON logs
- **Content:** Italian only · `allarounder.it` canonical, `allarounder.eu` 301-redirects
- **v1 scope:** articles, categories, tags, guests, cover image, Spotify link, custom admin, SEO
- **Phase 2:** newsletter, comments

See [DECISIONS.md](DECISIONS.md) for the full, dated log.

*Note: the project's skills plugin (`podcast-blog-website.plugin`) lives at the project root, outside `docs/`.*
