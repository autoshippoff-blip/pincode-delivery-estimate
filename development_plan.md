# DEVELOPMENT PLAN — Delivery ETA Widget SaaS

> Phased · Cost-optimized · Platform-agnostic · Render-hosted

---

## Guiding Rules

1. **Build only what's needed today** — no speculative features
2. **Each phase must be independently deployable**
3. **Every phase ends with a working, testable deliverable**
4. **No phase takes longer than 1 week solo or 3 days with a pair**
5. **Widget and API are versioned separately** — never break existing integrations

---

## Phase Overview

| Phase | Name                  | Output                         | Est. Duration |
|-------|-----------------------|--------------------------------|---------------|
| 0     | Project Setup         | Monorepo + CI/CD live          | 1 day         |
| 1     | Backend Foundation    | NestJS API + DB running        | 2–3 days      |
| 2     | ETA Engine            | Pincode → ETA API working      | 2–3 days      |
| 3     | Embeddable Widget     | Plug & play JS widget          | 2–3 days      |
| 4     | Shopify Extension     | Theme App Extension working    | 1–2 days      |
| 5     | Production Hardening  | Rate limits, logs, health      | 2 days        |
| 6     | SaaS Expansion        | Tenant dashboard, custom rules | Ongoing       |

---

## Phase 0 — Project Setup

### Goal
Get the monorepo, tooling, and CI/CD pipeline live before writing any feature code.

### Tasks

- [ ] Init monorepo with npm workspaces (`api/`, `widget/`)
- [ ] Setup `api/` as NestJS project with TypeScript strict mode
- [ ] Setup `widget/` as vanilla TS project with esbuild bundler
- [ ] Configure ESLint + Prettier for both workspaces
- [ ] Setup `.env` files with `.env.example` templates
- [ ] Create Render account + Web Service + PostgreSQL instance
- [ ] Configure GitHub Actions: lint → typecheck → deploy to Render
- [ ] Setup Render deploy hook in GitHub Actions secrets
- [ ] Add `README.md` with local dev setup instructions
- [ ] Configure Cloudflare for `cdn.yourdomain.com` pointing to Render static

### Deliverable
- Monorepo pushed to GitHub
- CI/CD pipeline passes (even with empty app)
- Render Web Service accessible at a public URL

### Environment Variables (`.env.example`)
```
DATABASE_URL=postgresql://user:pass@host:5432/eta_db
NODE_ENV=development
PORT=3000
CACHE_TTL_PINCODE=3600
CACHE_TTL_TENANT=300
THROTTLE_TTL=60
THROTTLE_LIMIT=60
```

---

## Phase 1 — Backend Foundation

### Goal
Running NestJS API connected to PostgreSQL with Prisma, pincode data seeded, tenant model ready.

### Tasks

#### NestJS Setup
- [ ] Install core dependencies: `@nestjs/core`, `@nestjs/config`, `@nestjs/throttler`, `helmet`, `pino`, `zod`
- [ ] Configure `ConfigModule` with `.env` validation via Zod
- [ ] Configure `ThrottlerModule` (60 req/min default)
- [ ] Add `helmet()` and CORS middleware in `main.ts`
- [ ] Setup `PinoLogger` as NestJS logger

#### Prisma + Database
- [ ] Install `prisma` + `@prisma/client`
- [ ] Write `schema.prisma` with: `Tenant` (including `EtaMode` enum), `Pincode`, `DeliveryRule`, `ApiLog`, `Warehouse`, `CourierProvider`, and `TenantCourierConfig`
- [ ] Run `prisma migrate dev` locally
- [ ] Create `PrismaService` as injectable provider
- [ ] Add `PrismaModule` as global module

#### Pincode Seeding
- [ ] Download India pincode dataset (CSV from data.gov.in or similar free source)
- [ ] Write `scripts/seed-pincodes.ts`:
  - Parse CSV with `papaparse` or `csv-parse`
  - Map state → region using `STATE_REGION_MAP`
  - Batch upsert into `Pincode` table (chunks of 500)
- [ ] Add `npm run seed:pincodes` script
- [ ] Verify ~155,000 pincodes imported

#### State → Region Map
```ts
// scripts/region-map.ts
export const STATE_REGION_MAP: Record<string, string> = {
  'Tamil Nadu': 'south',
  'Karnataka': 'south',
  'Kerala': 'south',
  'Andhra Pradesh': 'south',
  'Telangana': 'south',
  'Maharashtra': 'west',
  'Gujarat': 'west',
  'Goa': 'west',
  'Madhya Pradesh': 'central',
  'Chhattisgarh': 'central',
  'Rajasthan': 'central',
  'Delhi': 'north',
  'Uttar Pradesh': 'north',
  'Haryana': 'north',
  'Punjab': 'north',
  'Himachal Pradesh': 'north',
  'Uttarakhand': 'north',
  'Jammu and Kashmir': 'north',
  'West Bengal': 'east',
  'Odisha': 'east',
  'Jharkhand': 'east',
  'Bihar': 'east',
  'Assam': 'northeast',
  'Arunachal Pradesh': 'northeast',
  'Manipur': 'northeast',
  'Meghalaya': 'northeast',
  'Mizoram': 'northeast',
  'Nagaland': 'northeast',
  'Sikkim': 'northeast',
  'Tripura': 'northeast',
};
```

#### Health Module
- [ ] Create `GET /health` endpoint
- [ ] Check DB connectivity in health response

### Deliverable
- API starts on `localhost:3000`
- `GET /health` returns `{ status: "ok" }`
- PostgreSQL connected, pincodes seeded
- Deployed to Render successfully

---

## Phase 2 — ETA Engine

### Goal
The core `/api/v1/check-pincode` endpoint works end-to-end with caching and tenant resolution.

### Tasks

#### Tenant Module
- [ ] Create `TenantService` with `findByApiKey(key)` method
- [ ] Create `ApiKeyGuard` — extracts `X-API-Key` header, resolves tenant, attaches to request
- [ ] Seed at least one test tenant in `prisma/seed.ts`
- [ ] Cache tenant lookups in node-cache (TTL: 5min)

#### Cache Module
- [ ] Install `node-cache`
- [ ] Create `CacheService` wrapping `node-cache`:
  - `get<T>(key): T | undefined`
  - `set<T>(key, value, ttlSeconds): void`
  - `del(key): void`
- [ ] Register as global module

#### Pincode Module
- [ ] Create `PincodeService`:
  - `findByPincode(pincode: string): Promise<Pincode | null>`
  - Cache result with key `pincode:{pincode}`, TTL 60min (pincodes don't change)

#### ETA Module
- [ ] Create `CheckPincodeDto` (Zod validation):
  ```ts
  z.object({ pincode: z.string().regex(/^\d{6}$/) })
  ```
- [ ] Create `CourierStrategy` interface/base class under `strategies/` to lay foundation for future courier integrations
- [ ] Create `EtaEngine` (rules-based calculator):
  - `calculateEta(region, tenantRules): { min: number, max: number }`
  - Merges tenant-specific rules over default rules
- [ ] Create `RuleResolver`:
  - `resolveRules(tenantId): DeliveryRule[]`
  - Cache per tenant (TTL: 5min)
- [ ] Create `RegionMapper`:
  - `getRegion(state): string`
  - Uses `STATE_REGION_MAP`
- [ ] Create `EtaService` — orchestrates the full flow:
  - Checks `tenant.etaMode` (defaults to rules-based calculator for V1)
  - Resolves warehouse origin if available (prepares for V2/V3)
- [ ] Create `EtaController` — `POST /api/v1/check-pincode`
- [ ] Apply `ApiKeyGuard` to the controller

#### Analytics (Async Logging)
- [ ] Create `AnalyticsService.log()` — fire-and-forget DB insert into `ApiLog`
- [ ] Called from `EtaService` after response is ready (non-blocking)

### API Response Format
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

### Deliverable
- `POST /api/v1/check-pincode` works with a valid API key
- Returns correct ETA for any valid Indian pincode
- Cached responses on repeat requests
- Analytics logged to DB

---

## Phase 3 — Embeddable Widget

### Goal
A single JS file that any website can embed with one `<script>` tag to display the ETA widget.

### Tasks

#### Build Setup
- [ ] Configure esbuild in `widget/`:
  - Single output file: `dist/eta-widget.js`
  - Bundle target: ES2017 (broad browser support)
  - Inline CSS via `style` injection
  - Minify for production
- [ ] Add build + watch scripts to `package.json`

#### Widget Core (`widget/src/`)
- [ ] `index.ts` — Entry point:
  - Find `<div id="eta-widget">` or create and append to body
  - Read `data-api-key` from the script tag itself
  - Read optional `data-theme` (light/dark)
  - Mount widget UI into the target element
- [ ] `api.ts` — API client:
  - `checkPincode(pincode, apiKey, baseUrl): Promise<EtaResponse>`
  - Uses `fetch()` with timeout
  - Returns typed response or throws
- [ ] `validator.ts` — `isValidPincode(input): boolean` — `/^\d{6}$/`
- [ ] `ui.ts` — DOM renderer:
  - `render(container, state)` — pure function, diffs state
  - States: `idle | loading | success | error | invalid`
- [ ] `styles.ts` — Scoped CSS string, injected as `<style id="eta-widget-styles">`

#### Widget States (UI)
```
idle:    [  Enter pincode...  ] [Check Delivery]
loading: [  Enter pincode...  ] [   ⟳ Checking   ]
success: ✓ Estimated delivery: 3–4 Days
error:   ✕ This pincode is not serviceable
invalid: ! Please enter a valid 6-digit pincode
```

#### Widget Configuration (via data attributes)
```html
<script
  src="https://cdn.yourdomain.com/eta-widget.js"
  data-api-key="tk_live_xxxxx"
  data-theme="light"
  data-base-url="https://api.yourdomain.com"
  async
></script>
<div id="eta-widget"></div>
```

#### CORS Setup in API
- [ ] Update `TenantService` to store `allowedOrigins: string[]`
- [ ] Add dynamic CORS middleware — checks `Origin` header against tenant's allowed origins
- [ ] Tenant allowed origins configurable at creation time

#### Widget CDN Deploy
- [ ] Configure Render Static Site pointing to `widget/dist/`
- [ ] Set cache-control headers: `max-age=3600` on Cloudflare
- [ ] Widget URL: `https://cdn.yourdomain.com/eta-widget.js`

### Deliverable
- Widget embedded in a plain HTML test page works end-to-end
- Shows ETA on valid pincode, error on invalid
- Bundle < 25KB
- Deployed to Render Static

---

## Phase 4 — Shopify Theme App Extension

### Goal
The same widget running inside Shopify via a Theme App Extension — installable by merchants.

### Tasks

#### Shopify App Setup
- [ ] Install Shopify CLI: `npm install -g @shopify/cli`
- [ ] Create Shopify Partner account (free)
- [ ] Create new app in Partner Dashboard
- [ ] Generate Theme App Extension scaffold

#### Extension Files

**`shopify-extension/blocks/eta-widget.liquid`**
```liquid
<div id="eta-widget-{{ block.id }}"></div>
<script
  src="{{ 'eta-widget.js' | asset_url }}"
  data-api-key="{{ block.settings.api_key }}"
  data-mount-id="eta-widget-{{ block.id }}"
  data-theme="{{ block.settings.theme }}"
  defer
></script>

{% schema %}
{
  "name": "Delivery ETA",
  "target": "section",
  "settings": [
    { "type": "text", "id": "api_key", "label": "API Key" },
    { "type": "select", "id": "theme", "label": "Theme",
      "options": [
        { "value": "light", "label": "Light" },
        { "value": "dark", "label": "Dark" }
      ],
      "default": "light"
    }
  ]
}
{% endschema %}
```

- [ ] Copy `eta-widget.js` into `shopify-extension/assets/`
- [ ] Update widget `index.ts` to support `data-mount-id` (for multiple instances per page)
- [ ] Test in Shopify development store (free dev store available)
- [ ] Submit extension to Shopify for review

### Deliverable
- Merchants can install the app from Shopify Partner Dashboard
- Widget appears on product pages
- Works with the same API key system

---

## Phase 5 — Production Hardening

### Goal
The system is safe, observable, and stable enough for real merchants.

### Tasks

#### Rate Limiting
- [ ] Enforce `60 req/min` per API key (ThrottlerModule)
- [ ] Add IP-level fallback throttle: `100 req/min` per IP
- [ ] Return `429 Too Many Requests` with `Retry-After` header

#### Input Hardening
- [ ] Reject pincodes that are all zeros or known test values
- [ ] Sanitize all inputs before DB queries
- [ ] Add global exception filter — never leak stack traces in production

#### Monitoring & Logs
- [ ] Configure Pino to output JSON logs in production
- [ ] Connect Render logs to BetterStack (free tier)
- [ ] Setup uptime monitor on BetterStack for `/health`
- [ ] Add alert: if `/health` fails → email/Slack notification

#### Database
- [ ] Add DB indexes: `ApiLog(tenantId, createdAt)`, `Pincode(state)`, `Pincode(region)`
- [ ] Set `DATABASE_URL` connection pool limit: `connection_limit=5` (Render free PostgreSQL)
- [ ] Add `prisma migrate deploy` to Render start command

#### API Versioning
- [ ] Prefix all routes with `/api/v1/`
- [ ] Document that `/api/v2/` will be introduced for breaking changes

#### Security Checklist
- [ ] HTTPS enforced (Render provides TLS automatically)
- [ ] `helmet()` enabled
- [ ] CORS restricted to tenant-registered origins
- [ ] No sensitive data in logs (mask API keys)
- [ ] `NODE_ENV=production` set in Render environment

### Deliverable
- System handles 60 req/min per tenant safely
- Logs flowing to BetterStack
- Uptime monitor active
- No stack traces exposed in production errors

---

## Phase 6 — SaaS Expansion (Ongoing)

### Goal
Turn the working product into a self-serve SaaS that merchants can onboard to without manual intervention.

### Milestones (in priority order)

#### 6a — Tenant Self-Onboarding
- [ ] Simple signup form (name, email, website/shop URL)
- [ ] Auto-generate API key on signup
- [ ] Send API key via email (use Resend free tier — 3000 emails/mo)
- [ ] Tenant stored in DB as `isActive: true`

#### 6b — Tenant Dashboard (Minimal)
- [ ] Protected route: `GET /dashboard` (simple token-based auth)
- [ ] Show: API key, request count (last 7 days), top pincodes checked
- [ ] Allow: regenerate API key, update allowed origins

#### 6c — Custom ETA Rules per Tenant
- [ ] Tenant dashboard: override ETA per region
- [ ] API picks tenant rules first, falls back to defaults
- [ ] Validate: `minDays < maxDays`, both > 0

#### 6d — COD Availability (Simple)
- [ ] Add `cod_enabled: boolean` to `Tenant`
- [ ] Add `cod_blocked_pincodes: string[]` to `DeliveryRule` (optional)
- [ ] Widget shows "COD Available" / "Prepaid Only" badge

#### 6e — Courier Integrations (Shiprocket, Delhivery, Bluedart)
- [ ] Configure `CourierProvider` seeds in DB (Shiprocket, Delhivery, Bluedart)
- [ ] Add credentials fields/UI in Tenant Dashboard for courier APIs (saved to `TenantCourierConfig`)
- [ ] Update `EtaService` to instantiate dynamic strategy based on `tenant.etaMode`
- [ ] Implement live API lookup with strict 800ms timeouts and graceful fallback to Rule Engine

#### 6f — Per-Tenant Warehouse Origins (Phase 2 Roadmap)
- [ ] Support CRUD for `Warehouse` (origin address + pincode) in Tenant Dashboard
- [ ] Update `CheckPincodeDto` to accept origin warehouse id if applicable (or resolve tenant default warehouse)
- [ ] Build routing matrix: Calculate distance/zones between Warehouse Origin Pincode and Destination Pincode
- [ ] Allow setting rules based on origin-destination zones (e.g. Same City = 1-2 Days, Same State = 2-3 Days, Outer Zone = 5-7 Days)

#### 6g — Analytics Dashboard
- [ ] Charts: requests/day, top states, conversion (pincode checked → order placed)
- [ ] Use `ApiLog` table as source
- [ ] Simple HTML page with Chart.js (no external analytics SaaS needed)

---

## Non-Goals (Never Build These)

| Feature                    | Reason                          |
|----------------------------|---------------------------------|
| Kubernetes / Docker Swarm  | Overkill for this scale         |
| ML / AI ETA prediction     | No data + no ROI at MVP         |
| Microservices              | Single NestJS app is sufficient |
| Event-driven queue (BullMQ)| Async log insert is enough      |
| Multi-region DB            | Single Render DB is fine        |
| Real-time WebSocket ETA    | REST polling is sufficient      |

---

## Local Development Setup

```bash
# Clone and install
git clone https://github.com/your-org/delivery-eta-saas
cd delivery-eta-saas
npm install        # installs all workspaces

# Setup env
cp api/.env.example api/.env
# Edit DATABASE_URL to point to local PostgreSQL

# Database setup
cd api
npx prisma migrate dev
npm run seed:pincodes   # ~2min to import all pincodes

# Start API
npm run dev             # starts on :3000

# Build widget
cd ../widget
npm run dev             # esbuild watch mode → dist/eta-widget.js

# Test
open test/index.html    # plain HTML test page with widget embedded
```

---

## Definition of Done (per phase)

A phase is complete when:
- All tasks are checked off
- The deliverable is deployed to Render
- A manual smoke test passes
- No TypeScript errors (`tsc --noEmit`)
- ESLint passes with zero warnings
