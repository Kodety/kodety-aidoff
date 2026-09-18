# Production readiness

Read this reference whenever the user requests a production-capable result or
the scope includes real data, authentication, server logic, persistence, or
deployment. Apply only the sections relevant to the product; do not invent
infrastructure that the app does not need.

## 1. Boundary classification

Classify each integration as:

- `real`: connected to the intended service and exercised successfully;
- `adapter`: typed boundary is implemented, but final credentials/service are
  not connected;
- `mock`: deterministic local fixture or fake service;
- `blocked`: required contract, access, or infrastructure is missing.

Record the classification in the implementation map and any detailed report.
Keep chat handoffs concise, linking the evidence and surfacing material
integration blockers. Visual fidelity and a successful frontend build do not
upgrade a mock to `real`.

## 2. Data and server behavior

For real server/data work:

- validate and normalize untrusted input at the server boundary;
- use typed request/response or schema contracts;
- implement loading, timeout, retry/cancel policy, empty, partial, and failure
  states appropriate to the action;
- avoid optimistic success when the mutation can fail unless rollback and
  conflict behavior are implemented;
- keep persistence/migrations/seeds versioned and repeatable when the scope
  owns a database;
- prevent duplicate submissions and make retries safe where required;
- avoid exposing internal errors or sensitive fields to the client;
- use deterministic fixtures only outside the real production path.

Do not infer fields, validation rules, retention, or destructive behavior from
the arrangement of a Figma form.

## 3. Authentication and authorization

- Reuse the repository's established identity/session system.
- Enforce authorization on the server or trusted boundary, not by hiding UI.
- Model roles and ownership only from supplied product/security requirements.
- Protect state-changing requests using the framework's appropriate session,
  origin, CSRF, and replay controls.
- Handle expiry, signed-out, forbidden, and reauthentication states.
- Do not persist sensitive credentials in local storage or expose server-only
  environment variables to browser code.

If authentication or permissions are required but their rules are missing,
implement only the adapter/UI boundary and report the production blocker.
Public content sites without auth requirements do not need an auth boundary.

## 4. Configuration and secrets

- Commit a safe `.env.example` only when it helps users configure required
  variables; never include real values.
- Validate required configuration at startup with clear non-secret errors.
- Keep public/client environment variables separate from secrets.
- Do not copy tokens from Figma, API tools, logs, or local machines into source,
  screenshots, fixtures, or reports.
- Ensure production defaults do not point to mock services accidentally.

## 5. Runtime quality gates

Run the repository's applicable checks:

- static type checking;
- lint/format verification;
- unit/component tests for stateful logic;
- integration tests for data boundaries;
- browser/E2E smoke tests for critical flows and deep links;
- accessibility checks plus manual keyboard/focus review;
- production build;
- served production artifact or production-mode server smoke test;
- console, unhandled rejection, failed request, and broken asset review;
- performance review for the initial route and critical interaction.

A development server alone is not a production verification. Test the built
mode, including refresh/direct navigation on non-root routes.

## 6. Operational behavior

When the application owns production operations, ensure appropriate:

- structured error reporting without secrets or personal data;
- health/readiness behavior;
- request timeouts and cancellation;
- graceful empty/error UI;
- cache invalidation and stale-data behavior;
- rollback or recovery for risky mutations;
- rate/abuse protections for exposed endpoints;
- backup/migration/rollback planning for persistent changes.

Scale these checks to the product. A static authenticated client does not need
a database migration plan; a new database-backed feature does.

## 7. Performance and accessibility

- Profile the critical route and interaction with representative data in the
  production build. Record the environment, workload, relevant baseline,
  results, and known limits in existing evidence. Choose applicable measures
  such as interaction latency, render cost, bundle size, request count,
  server latency, and memory use; do not impose arbitrary universal budgets.
- Reserve media dimensions and keep the primary visual from shifting.
- Load exact fonts efficiently and avoid requesting unused weights.
- Optimize images without visible degradation; use responsive sources when
  different display sizes justify them.
- Keep route and component code from shipping server-only or unused heavy
  dependencies to the browser.
- Respect reduced motion, contrast, focus visibility, semantic controls, text
  resizing, and usable touch targets.
- Test representative data volume for tables, lists, charts, and virtualized
  regions. Use pagination or virtualization when rendering the full dataset
  is costly, preserving keyboard access, focus, and other required behavior.
- Verify that targeted memoization or caching reduces relevant work without
  stale state, incorrect invalidation, unbounded memory, or lost updates.
- Where server/data work is in scope, bound queries and payloads, avoid N+1
  access patterns, and use indexes supported by actual query patterns. Bound
  concurrency, retries, queues, and cache growth; specify invalidation and
  authorization-aware cache keys where caching is justified.
- Reuse the existing runtime's connection/resource management. Move lengthy
  work off the request path only when requirements justify it and job failure,
  retry, and duplicate-processing behavior are defined. Do not add distributed
  infrastructure solely to claim scalability.
- Check realistic data growth and expected concurrency in local or isolated
  test environments when relevant and feasible. Never load-test shared or
  production services without explicit authorization. Report untested capacity
  as unverified; a successful build or a small fixture is not capacity evidence.

Record intentional deviations when a Figma treatment is changed for safety,
performance, or accessibility.

## 8. Deployment boundary

Deployment is a separate external mutation:

1. Deploy only when the user explicitly requests it.
2. Inspect the target provider/project/environment before mutating it.
3. Confirm build/configuration without exposing credentials.
4. Use preview/staging first when available.
5. Verify the deployed route, assets, deep links, API boundary, and critical
   flow from the public environment.
6. Report the verified URL and environment. Do not call a local or preview-only
   build “deployed to production.”

When a user asks for “localhost and production” without naming a provider,
project, or environment, default to the local development command plus a
production build served in preview/production mode. Deployment still requires
an explicit target or an unmistakable request to publish.

## 9. Production claim

Use three distinct claim levels:

- `production-build-verified`: the optimized build passes and its served mode,
  assets, deep links, and critical UI flow were smoke-tested;
- `production-integrated`: the build is verified and all product-required
  integrations are `real`, with applicable auth/data/operational gates passed;
- `deployed-and-verified`: the intended external environment was explicitly
  deployed and tested from its public/runtime URL.

For any production claim, record `typecheck`, `lint`, `test`, `accessibility`,
`build`, and `smoke` in the implementation map. Typecheck/lint/test may be
`not-applicable` only with a concrete product/stack reason; build, browser
smoke, and accessibility must pass. Each passed check carries its command or
verification action, zero exit status, method, and timestamp. A real
integration names its own passed integration check. These records support
readback and consistency validation; retain the actual repository/test output
needed by the team's normal CI or review process.

Do not collapse these into a generic “production ready.” Otherwise use precise
language such as:

- “production build passes; backend adapter remains unconnected”;
- “UI and routes are production-capable; authentication contract is blocked”;
- “local functional app with deterministic mocks”;
- “deployed preview verified; production deployment was not requested.”

This distinction is part of correctness, not merely reporting style.
