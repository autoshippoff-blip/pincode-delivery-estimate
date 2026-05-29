# AGENT.md — AI Coding Agent Instructions

> This file tells AI coding agents (Claude Code, Cursor, Copilot, etc.) exactly how to work on this project.
> Read this file before writing any code. Follow it strictly.

---

## Project Identity

**Name:** Delivery ETA Widget SaaS  
**Purpose:** Embeddable delivery estimation widget for any website or Shopify store  
**Stack:** NestJS · TypeScript · Prisma · PostgreSQL · Vanilla TS Widget · Render  
**Repo structure:** npm monorepo with `api/` and `widget/` workspaces

---

## Golden Rules

1. **Never install a library without checking if a simpler built-in works.**
2. **Never use `any` in TypeScript.** Use `unknown` and narrow it.
3. **Never expose stack traces or internal errors in API responses.**
4. **Never write raw SQL.** Use Prisma.
5. **Never block the main thread with synchronous I/O.**
6. **Never commit secrets.** Use `.env` and `.env.example`.
7. **Never skip Zod validation on incoming data.**
8. **Never tightly couple modules.** ETA logic must not import Tenant logic directly.
9. **Always handle the null/undefined case** from DB lookups.
10. **Always write the type first, then the implementation.**

---

## Project Structure

```
delivery-eta-saas/
├── api/              ← NestJS backend
├── widget/           ← Vanilla TS embeddable widget
├── .github/workflows/
└── package.json      ← Workspace root
```

When asked to work on the backend, you are in `api/`.  
When asked to work on the widget, you are in `widget/`.  
Never mix concerns between the two.

---

## Code Style

### TypeScript

```ts
// ✅ CORRECT
const result: PincodeRow | null = await this.prisma.pincode.findUnique({
  where: { pincode },
});
if (!result) throw new NotFoundException('Pincode not found');

// ❌ WRONG
const result: any = await ...
```

- Strict mode is ON (`"strict": true` in tsconfig)
- Prefer `interface` for shapes, `type` for unions
- Use `readonly` on DTO properties
- Use `as const` on static lookup maps
- Avoid `!` non-null assertions — check explicitly

### Naming Conventions

| Thing             | Convention          | Example                     |
|-------------------|---------------------|-----------------------------|
| Files             | kebab-case          | `eta-engine.ts`             |
| Classes           | PascalCase          | `EtaEngine`                 |
| Interfaces        | PascalCase          | `EtaResponse`               |
| Functions         | camelCase           | `calculateEta()`            |
| Constants         | UPPER_SNAKE_CASE    | `DEFAULT_ETA_RULES`         |
| DB columns        | camelCase (Prisma)  | `createdAt`, `tenantId`     |
| Env vars          | UPPER_SNAKE_CASE    | `DATABASE_URL`              |
| API routes        | kebab-case          | `/api/v1/check-pincode`     |
| Cache keys        | `entity:{id}`       | `pincode:560001`            |

### File Organization

Each NestJS module contains:
```
module-name/
├── module-name.controller.ts
├── module-name.service.ts
├── module-name.module.ts
├── dto/
│   └── module-name.dto.ts
└── entities/
    └── module-name.entity.ts   (if needed)
```

Do not add files that aren't needed. Do not create `utils/` inside a module — put shared utils in `common/utils/`.

---

## NestJS Patterns

### Controller Pattern

```ts
@Controller('api/v1')
@UseGuards(ApiKeyGuard)
export class EtaController {
  constructor(private readonly etaService: EtaService) {}

  @Post('check-pincode')
  async checkPincode(
    @Body() dto: CheckPincodeDto,
    @Req() req: RequestWithTenant,
  ): Promise<EtaResponseDto> {
    return this.etaService.checkPincode(dto.pincode, req.tenant);
  }
}
```

### Service Pattern

```ts
@Injectable()
export class EtaService {
  constructor(
    private readonly pincodeService: PincodeService,
    private readonly cacheService: CacheService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async checkPincode(pincode: string, tenant: Tenant): Promise<EtaResponseDto> {
    const cacheKey = `eta:${tenant.id}:${pincode}`;
    const cached = this.cacheService.get<EtaResponseDto>(cacheKey);
    if (cached) return cached;

    const pincodeRow = await this.pincodeService.findByPincode(pincode);
    if (!pincodeRow) {
      return { success: false, error: 'PINCODE_NOT_FOUND', serviceable: false };
    }

    const eta = this.etaEngine.calculate(pincodeRow.region, tenant.rules);
    const response: EtaResponseDto = { success: true, ...eta, serviceable: true };

    this.cacheService.set(cacheKey, response, 600);
    this.analyticsService.log(tenant.id, pincode, pincodeRow).catch(() => {});

    return response;
  }
}
```

### DTO Pattern (Zod + class-transformer)

```ts
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const CheckPincodeSchema = z.object({
  pincode: z.string().regex(/^\d{6}$/, 'Must be a 6-digit number'),
});

export class CheckPincodeDto extends createZodDto(CheckPincodeSchema) {}
```

### Guard Pattern

```ts
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly tenantService: TenantService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithTenant>();
    const apiKey = req.headers['x-api-key'];
    if (typeof apiKey !== 'string') throw new UnauthorizedException();

    const tenant = await this.tenantService.findByApiKey(apiKey);
    if (!tenant || !tenant.isActive) throw new UnauthorizedException();

    req.tenant = tenant;
    return true;
  }
}
```

---

## Cache Usage Rules

- Use `CacheService` — never import `node-cache` directly in a service.
- Always define the cache key as a constant string template at the top of the service.
- Always specify TTL explicitly — never rely on defaults.
- Never cache error responses.

```ts
private readonly CACHE_KEYS = {
  pincode: (p: string) => `pincode:${p}`,
  tenant: (key: string) => `tenant:${key}`,
  etaRules: (tenantId: string) => `eta-rules:${tenantId}`,
} as const;
```

---

## Error Handling

### HTTP Errors — use NestJS built-ins

```ts
throw new NotFoundException('Pincode not found');
throw new UnauthorizedException('Invalid API key');
throw new BadRequestException('Pincode must be 6 digits');
throw new TooManyRequestsException('Rate limit exceeded');
```

### Global Filter

The `HttpExceptionFilter` must be applied globally in `main.ts`. It formats all errors as:

```json
{
  "success": false,
  "error": "PINCODE_NOT_FOUND",
  "message": "Pincode not found",
  "statusCode": 404
}
```

Never include `stack`, internal Prisma errors, or raw exception messages in production responses.

---

## Prisma Rules

- Always use `prisma.$transaction()` when making multiple related writes.
- Use `findUnique` (not `findFirst`) when querying by unique fields.
- Use `select` to limit returned columns — don't return full rows if you need 2 fields.
- Never use `deleteMany` in production code without a where clause.
- Migrations go in `prisma/migrations/` — never edit them after they've been applied.

```ts
// ✅ CORRECT - limit fields
const pincode = await this.prisma.pincode.findUnique({
  where: { pincode },
  select: { state: true, region: true, district: true },
});

// ❌ WRONG - returns all columns including lat/lng we don't need
const pincode = await this.prisma.pincode.findUnique({ where: { pincode } });
```

---

## Widget Rules

These rules apply to `widget/src/` only.

### No frameworks. No dependencies.

The widget is vanilla TypeScript compiled to a single JS file.  
Do not install React, Vue, lit, or any UI library.  
Use only the browser's native DOM APIs.

### DOM manipulation pattern

```ts
// ✅ CORRECT - create elements programmatically
function renderSuccess(container: HTMLElement, message: string): void {
  container.innerHTML = '';
  const badge = document.createElement('div');
  badge.className = 'eta-badge eta-badge--success';
  badge.textContent = message;
  container.appendChild(badge);
}

// ❌ WRONG - never use innerHTML with user-provided data
container.innerHTML = `<div>${userInput}</div>`;
```

### CSS scoping

All widget styles must be prefixed with `.eta-widget` to prevent style leakage into the host page.

```css
/* ✅ CORRECT */
.eta-widget .eta-input { ... }
.eta-widget .eta-button { ... }

/* ❌ WRONG */
input { ... }
button { ... }
```

### Widget entry point

The widget reads its config from the `<script>` tag's data attributes:

```ts
function getScriptConfig(): WidgetConfig {
  const script = document.currentScript as HTMLScriptElement | null;
  if (!script) throw new Error('eta-widget: must be loaded via <script> tag');

  const apiKey = script.getAttribute('data-api-key');
  if (!apiKey) throw new Error('eta-widget: data-api-key is required');

  return {
    apiKey,
    theme: (script.getAttribute('data-theme') ?? 'light') as Theme,
    baseUrl: script.getAttribute('data-base-url') ?? 'https://api.yourdomain.com',
    mountId: script.getAttribute('data-mount-id') ?? 'eta-widget',
  };
}
```

---

## Environment Variables

Only these env vars are accepted. Never add new ones without updating `.env.example` and the Zod config schema.

| Variable             | Required | Description                        |
|----------------------|----------|------------------------------------|
| `DATABASE_URL`       | Yes      | PostgreSQL connection string       |
| `PORT`               | No       | Defaults to 3000                   |
| `NODE_ENV`           | Yes      | `development` or `production`      |
| `CACHE_TTL_PINCODE`  | No       | Seconds. Default 3600              |
| `CACHE_TTL_TENANT`   | No       | Seconds. Default 300               |
| `THROTTLE_TTL`       | No       | Seconds. Default 60                |
| `THROTTLE_LIMIT`     | No       | Requests per TTL. Default 60       |

---

## Testing Checklist (before marking any task done)

For every new endpoint or service method:

- [ ] Happy path works with valid data
- [ ] Returns correct error for missing pincode
- [ ] Returns 401 for missing/invalid API key
- [ ] Returns 429 after rate limit is exceeded
- [ ] Cached response returns on second call (check logs)
- [ ] No TypeScript errors (`cd api && npx tsc --noEmit`)
- [ ] ESLint passes (`npm run lint`)

---

## What NOT to Build

Do not build any of the following unless explicitly instructed:

- Redis integration (node-cache is sufficient)
- AI/ML ETA prediction
- Kubernetes or Docker Compose for local dev
- BullMQ or any queue system
- Microservices or separate deployable services
- Shiprocket / Delhivery / Bluedart integrations (Phase 6e only)
- Admin dashboard (Phase 6b only)
- Webhook system
- Real-time WebSocket updates
- Multi-warehouse routing (Phase 6f only)

If a task seems to require one of the above, stop and ask.

---

## How to Add a New Feature

1. Check `development_plan.md` to confirm it's in scope for the current phase.
2. If it touches the DB, create a Prisma migration first.
3. Write the DTO (Zod schema).
4. Write the service method.
5. Wire it into the controller.
6. Update `.env.example` if a new env var is needed.
7. Test manually (checklist above).
8. Update `architecture.md` if the design changed.

---

## Commit Message Format

```
type(scope): short description

Types: feat | fix | chore | refactor | docs | test
Scope: api | widget | db | config | ci

Examples:
feat(api): add check-pincode endpoint
fix(widget): handle empty API key gracefully
chore(db): add index on ApiLog.tenantId
refactor(api): extract region mapper to separate module
docs: update architecture with CORS details
```

---

## Render Deployment Notes

- The Render Web Service start command must be:
  ```
  npx prisma migrate deploy && node dist/main.js
  ```
- Build command:
  ```
  npm run build
  ```
- `NODE_ENV=production` must be set in Render environment variables.
- The PostgreSQL `DATABASE_URL` comes from Render's internal network URL (not the external one) to avoid egress costs.
- The Render Static Site for the widget serves from `widget/dist/`.

---

## When You're Stuck

1. Re-read `architecture.md` — the answer is probably there.
2. Check `development_plan.md` for the exact task description.
3. Check NestJS docs for patterns: https://docs.nestjs.com
4. Check Prisma docs: https://www.prisma.io/docs
5. Do not invent patterns — follow what's already established in the codebase.
6. If the approach requires installing a new library, stop and ask first.
