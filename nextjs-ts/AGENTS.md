# Souk Code Lite: Next.js/TypeScript project guidance

A free sample of six rules. Inspect the repository, installed versions and existing tests before editing. Preserve project conventions, propose the smallest justified change, and report which checks you actually ran.

# Auth And Security

## NXT-server-authz

Check session identity and resource ownership at the data mutation boundary.

Reason: Middleware or hidden controls are not a complete authorization boundary.

## NXT-server-secrets

Keep secrets in server-only modules and never prefix them NEXT_PUBLIC_.

Reason: Public environment values are bundled for the browser.

```tsx
// Bad
const secret = process.env.NEXT_PUBLIC_SERVICE_SECRET;
// Good: read private secrets only in a server-only module.
```

## NXT-csrf-boundary

Review CSRF and origin checks for cookie-authenticated mutation endpoints.

Reason: Route handlers do not automatically inherit Server Action protections; webhooks need signature checks.

# Typescript Strictness

## NXT-unknown-boundary

Parse unknown external input before using it as a domain type.

Reason: A TypeScript assertion does not validate runtime data.

```tsx
// Bad
const input = body as CreateItem;
// Good: use the project’s installed schema validator
const input = createItemSchema.parse(body);
```

## NXT-no-any

Use unknown, narrowing or generics instead of adding any to bypass a type error.

Reason: Escapes hide contracts rather than fixing them.

## NXT-strict-baseline

Preserve strict compiler options and fix new type errors.

Reason: Disabling strictness weakens unrelated parts of the project.
