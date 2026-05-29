# ARCHITECTURE — Delivery ETA Widget SaaS

> Platform-agnostic · Cost-optimized · Render-hosted · Plug & Play

---

## Overview

A lightweight, multi-tenant Delivery ETA SaaS that works on **any website** and **Shopify stores** via a single embeddable JS widget. No AI. No Docker. No overengineering.

---

## Core Design Principles

- **One codebase, one backend** — shared by all tenants and all platforms
- **Plug & play widget** — one `<script>` tag for any website; Theme App Extension for Shopify
- **Local-first data** — India pincode dataset lives in PostgreSQL, no external API calls
- **Cost-first decisions** — every layer chosen for minimal monthly spend
- **Monorepo** — single repo, two workspaces: `api/` and `widget/`

---

## High-Level Architecture

```
Any Website / Shopify Store
         │
         │  <script> embed  OR  Theme App Extension
         ▼
┌─────────────────────────┐
│   ETA Widget (JS)       │  ← Hosted on Render Static / Cloudflare CDN
│   Vanilla TS, ~20KB     │
└────────────┬────────────┘
             │ HTTPS POST
             ▼
┌─────────────────────────┐
│   NestJS API            │  ← Render Web Service
│   + Rate Limiting       │
│   + Tenant Auth         │
└────────────┬────────────┘
             │
     ┌───────┴───────┐
     ▼               ▼
┌────────────┐┌─────────────┐
│ Tenant     ││ ETA         │
│ Resolver   ││ Resolver    │
└────────────┘└──────┬──────┘
                     │
         ┌───────────┴───────────┐
         ▼ (Live Courier)        ▼ (Static Rules / Fallback)
   ┌───────────┐           ┌───────────┐
   │ Courier   │           │ Rule      │
   │ API       │           │ Engine    │
   │ Gateway   │           └─────┬─────┘
   └─────┬─────b                 │
         │ (API check)           │ (Cache check / DB miss)
         ▼                       ▼
   ┌───────────┐           ┌───────────┐
   │ Shiprocket│           │node-cache │ ← L1 cache, 10min TTL
   │ Delhivery │           └─────┬─────┘
   │ Bluedart  │                 │ cache miss
   └───────────┘                 ▼
                           ┌───────────┐
                           │ PostgreSQL│ ← Render Managed DB
                           │ Pincodes, │
                           │ Warehouses│
                           │ Rules,    │
                           │ Logs      │
                           └───────────┘
```

---


## Platform Integration

### For Any Website (HTML embed)

```html
<script
  src="https://cdn.yourdomain.com/eta-widget.js"
  data-api-key="YOUR_API_KEY"
  data-theme="light"
  async
></script>

<div id="eta-widget"></div>
```

The widget auto-mounts into `#eta-widget`. Zero dependencies. Zero config beyond the `data-api-key`.

---

### For Shopify (Theme App Extension)

```liquid
<!-- blocks/eta-widget.liquid -->
<div id="eta-widget"></div>
<script
  src="{{ 'eta-widget.js' | asset_url }}"
  data-api-key="{{ block.settings.api_key }}"
  defer
></script>
```

The **same JS bundle** powers both platforms. The widget detects its host environment and adapts rendering.

---

## Monorepo Structure

```
delivery-eta-saas/
│
├── api/                          ← NestJS Backend
│   ├── src/
│   │   ├── modules/
│   │   │   ├── eta/              ← ETA engine, rules, resolver
│   │   │   ├── pincode/          ← Pincode lookup service
│   │   │   ├── tenant/           ← Multi-tenant resolution
│   │   │   ├── auth/             ← API key guard
│   │   │   ├── analytics/        ← Lightweight request logging
│   │   │   └── health/           ← /health endpoint
│   │   ├── common/
│   │   │   ├── guards/
│   │   │   ├── middleware/
│   │   │   ├── filters/
│   │   │   └── interceptors/
│   │   ├── cache/                ← node-cache wrapper
│   │   ├── config/               ← @nestjs/config
│   │   └── main.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── scripts/
│   │   └── seed-pincodes.ts      ← One-time pincode import
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
│
├── widget/                       ← Embeddable JS Widget
│   ├── src/
│   │   ├── index.ts              ← Entry point, auto-mount
│   │   ├── ui.ts                 ← DOM rendering
│   │   ├── api.ts                ← fetch() wrapper
│   │   ├── validator.ts          ← Pincode format check
│   │   └── styles.ts             ← Injected CSS (scoped)
│   ├── dist/                     ← Built output (served via CDN)
│   │   └── eta-widget.js         ← Single bundle, ~20KB
│   ├── package.json
│   └── tsconfig.json
│
├── .github/
│   └── workflows/
│       └── deploy.yml
└── package.json                  ← Workspace root
```

---

## Backend Module Design

### ETA Module

```
eta/
├── eta.controller.ts       ← POST /api/v1/check-pincode
├── eta.service.ts          ← Orchestrates lookup + rule/courier resolver
├── eta.engine.ts           ← Pure ETA calculation logic
├── region.mapper.ts        ← State → Region mapping
├── rule.resolver.ts        ← Tenant rules → fallback to defaults
├── strategies/             ← Courier integration strategies (V1 prepared, V2/3 live)
│   ├── courier-strategy.interface.ts
│   ├── shiprocket.strategy.ts
│   ├── delhivery.strategy.ts
│   └── bluedart.strategy.ts
├── dto/
│   ├── check-pincode.dto.ts
│   └── eta-response.dto.ts
└── eta.module.ts
```

### ETA Calculation Flow

```
POST /api/v1/check-pincode
        │
        ▼
[1] Validate API Key → resolve Tenant & configurations (EtaMode, Warehouses)
        │
        ▼
[2] Validate pincode format (6-digit regex)
        │
        ▼
[3] Check node-cache → HIT → return cached ETA
        │ MISS
        ▼
[4] Lookup destination pincode in PostgreSQL → get State + Region + Lat/Lng
        │
        ▼
[5] Determine Tenant's Courier/ETA Strategy (Tenant.etaMode)
        │
        ├── LIVE COURIER (SHIPROCKET | DELHIVERY | BLUEDART)
        │     ├─► Query Courier API (uses Warehouse Origin Pincode + Destination Pincode)
        │     ├─► Live ETA Available? → Return Live ETA
        │     └─► Error / Timeout (>800ms) → Fallback to Rule Engine
        │
        └── STATIC_RULES / FALLBACK
              ├─► Check Tenant Warehouses (if multiple, find closest or default origin)
              ├─► Apply Tenant Pincode/Region overrides (Region → ETA)
              └─► Fallback to System Default Region rules
        │
        ▼
[6] Format response → cache result (10min TTL)
        │
        ▼
[7] Log to analytics (async, non-blocking)
        │
        ▼
[8] Return ETA response
```

---

## API Contract

### POST /api/v1/check-pincode

**Headers:**
```
X-API-Key: tenant_api_key_here
Content-Type: application/json
```

**Request:**
```json
{
  "pincode": "560001"
}
```

**Success Response:**
```json
{
  "success": true,
  "pincode": "560001",
  "district": "Bangalore",
  "state": "Karnataka",
  "region": "south",
  "estimated_delivery": "3–4 Days",
  "serviceable": true
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "PINCODE_NOT_FOUND",
  "message": "This pincode is not serviceable yet."
}
```

---

### GET /health

```json
{
  "status": "ok",
  "db": "connected",
  "uptime": 3600
}
```

---

## Database Schema (Prisma)

```prisma
enum EtaMode {
  STATIC_RULES
  SHIPROCKET
  DELHIVERY
  BLUEDART
  CUSTOM
}

model Tenant {
  id             String                @id @default(uuid())
  name           String
  shopDomain     String?               @unique   // null for non-Shopify
  siteUrl        String?                         // for plain website tenants
  apiKey         String                @unique
  isActive       Boolean               @default(true)
  etaMode        EtaMode               @default(STATIC_RULES)
  allowedOrigins String[]
  createdAt      DateTime              @default(now())
  rules          DeliveryRule[]
  warehouses     Warehouse[]
  courierConfigs TenantCourierConfig[]
  logs           ApiLog[]
}

model Pincode {
  pincode     String   @id
  officeName  String
  district    String
  state       String
  region      String   // south | north | east | west | northeast | central
  latitude    Float?
  longitude   Float?
}

model Warehouse {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  name      String
  pincode   String
  city      String
  state     String
  createdAt DateTime @default(now())
}

model CourierProvider {
  id          String                @id // e.g. "SHIPROCKET", "DELHIVERY", "BLUEDART"
  name        String
  isActive    Boolean               @default(true)
  configs     TenantCourierConfig[]
}

model TenantCourierConfig {
  id                String          @id @default(uuid())
  tenantId          String
  tenant            Tenant          @relation(fields: [tenantId], references: [id])
  courierProviderId String
  courierProvider   CourierProvider @relation(fields: [courierProviderId], references: [id])
  apiKey            String?
  apiSecret         String?
  configJson        String?         // JSON payload for extra configurations (e.g. usernames, settings)
  isActive          Boolean         @default(true)
  createdAt         DateTime        @default(now())
}

model DeliveryRule {
  id        String  @id @default(uuid())
  tenantId  String
  tenant    Tenant  @relation(fields: [tenantId], references: [id])
  region    String
  minDays   Int
  maxDays   Int
  isActive  Boolean @default(true)
}

model ApiLog {
  id             String   @id @default(uuid())
  tenantId       String
  tenant         Tenant   @relation(fields: [tenantId], references: [id])
  pincode        String
  state          String?
  region         String?
  responseTimeMs Int
  success        Boolean
  createdAt      DateTime @default(now())

  @@index([tenantId, createdAt])
}
```

---

## Default ETA Rules (Fallback)

```ts
export const DEFAULT_ETA_RULES = {
  south:     { min: 2, max: 4 },  // TN, KA, KL, AP, TG
  west:      { min: 3, max: 5 },  // MH, GJ, GOA
  central:   { min: 4, max: 6 },  // MP, CG, RJ
  north:     { min: 5, max: 7 },  // DL, UP, HR, PB, UK, HP, JK
  east:      { min: 5, max: 7 },  // WB, OD, JH, BR
  northeast: { min: 7, max: 10 }, // AS, AR, MN, ML, MZ, NL, SK, TR
};
```

Tenants can override any region rule via `DeliveryRule` records.

---

## Widget Architecture

### Lifecycle

```
Script tag parsed by browser
         │
         ▼
Auto-detect mount target (#eta-widget or create one)
         │
         ▼
Inject scoped CSS into <head>
         │
         ▼
Render pincode input + button
         │
Customer types pincode → clicks Check
         │
         ▼
Validate format client-side (6-digit number)
         │
         ▼
POST to API with X-API-Key from data attribute
         │
         ▼
Show loading spinner
         │
         ▼
Render ETA result OR error message
```

### Widget States

| State    | UI Shown                             |
|----------|--------------------------------------|
| idle     | Input + "Check Delivery" button      |
| loading  | Spinner inside button                |
| success  | "Delivers in 3–4 Days" green badge   |
| error    | "Pincode not serviceable" soft error |
| invalid  | "Enter a valid 6-digit pincode"      |

### Widget Bundle Target

| Metric        | Target   |
|---------------|----------|
| JS bundle     | < 25KB   |
| CSS injected  | < 2KB    |
| Load time     | < 800ms  |
| API response  | < 200ms  |

---

## Caching Strategy

### L1 — node-cache (in-memory, per instance)

```
Key:   pincode:{pincode}           → pincode DB row, TTL 60min
Key:   eta:{tenantId}:{region}     → resolved ETA rule, TTL 5min
Key:   tenant:{apiKey}             → tenant record, TTL 5min
```

No Redis needed for MVP. If Render scales to multiple instances, promote to Redis (Upstash free tier).

---

## Security

| Concern          | Solution                  |
|------------------|---------------------------|
| HTTPS            | Render TLS (automatic)    |
| CORS             | Whitelist per tenant domain |
| Rate Limiting    | @nestjs/throttler: 60 req/min/key |
| Input Validation | Zod on all DTOs           |
| SQL Injection    | Prisma (parameterized)    |
| Headers          | Helmet                    |
| API Abuse        | API Key per tenant        |
| Widget Origin    | Referrer check optional   |

---

## Hosting & Cost Breakdown

| Service              | Plan              | Monthly Cost |
|----------------------|-------------------|-------------|
| Render Web Service   | Starter ($7)      | $7.00       |
| Render PostgreSQL    | Free (1GB, 90d)   | $0.00       |
| Cloudflare CDN       | Free              | $0.00       |
| GitHub Actions CI/CD | Free (2000 min)   | $0.00       |
| BetterStack Logs     | Free tier         | $0.00       |
| **Total MVP**        |                   | **~$7/mo**  |

After 90 days, PostgreSQL moves to $7/mo → **~$14/mo total**.

> Use Render's free web service during dev (sleeps after 15min). Move to Starter ($7) for production to eliminate cold starts.

---

## Deployment Architecture

```
GitHub Push → main
       │
       ▼
GitHub Actions
  ├── lint + typecheck
  ├── run tests
  └── deploy to Render (via Render Deploy Hook)
       │
       ├── Render Web Service (NestJS API)
       │     └── auto runs: prisma migrate deploy + seed
       │
       └── Render Static Site (Widget JS bundle)
             └── served at: cdn.yourdomain.com/eta-widget.js
```

---

## CORS Configuration

Each tenant registers their domain(s) on signup. The API enforces per-tenant CORS:

```ts
// Checked at request time via middleware
allowedOrigins: tenant.allowedOrigins  // ['https://mystore.com', '*.myshopify.com']
```

This prevents API key theft — even if the key is exposed in frontend HTML, it only works from registered origins.

---

## Feature Flags (Simple, DB-backed)

```prisma
model FeatureFlag {
  id       String  @id @default(uuid())
  tenantId String?  // null = global default
  flag     String   // 'cod_check', 'shiprocket', etc.
  enabled  Boolean  @default(false)
}
```

Flags checked in service layer. Costs nothing, enables clean future rollouts.

---

## Future Scale Path (No Rewrites Needed)

```
MVP ($7/mo)                Production Scale
─────────────────────────────────────────────
node-cache          →      Redis (Upstash)
Render Starter      →      Render Standard / AWS
Single instance     →      Horizontal scale
Manual tenant mgmt  →      Admin dashboard
Default ETA rules   →      Per-courier, per-warehouse rules
```

---

## What Was Removed vs Original Spec

| Removed              | Reason                              |
|----------------------|-------------------------------------|
| AI ETA prediction    | Unnecessary complexity + cost       |
| Railway              | Replaced with Render                |
| Redis (MVP)          | node-cache sufficient for MVP       |
| Kubernetes           | Overkill                            |
| Docker (dev)         | Removed per requirement             |
| Shopify-only widget  | Now platform-agnostic               |
| BullMQ queue         | Analytics logged synchronously      |
| Prometheus           | BetterStack free tier sufficient    |
| Sentry               | Added back optionally in Phase 4    |
