# Souk Code Lite: Laravel project guidance

A free sample of six rules. Inspect the repository, installed versions and existing tests before editing. Preserve project conventions, propose the smallest justified change, and report which checks you actually ran.

# Security

## LAR-mass-assignment

Map validated fields explicitly and keep ownership fields server-controlled.

Reason: A broad validated array can still include unsafe business fields.

```php
// Bad
$order->fill($request->all());
// Good
$order->fill(['notes' => $request->validated('notes')]);
```

## LAR-uploads

Validate upload size and content type and store files with generated names outside executable paths.

Reason: Client filenames and MIME declarations are untrusted; public execution creates risk.

## LAR-csrf-secrets

Keep session-authenticated mutations under CSRF protection and keep secrets out of logs and commits.

Reason: Authentication cookies travel automatically and leaked credentials remain usable.

# Testing

## LAR-behavior-tests

Cover successful, invalid and forbidden paths with feature tests.

Reason: A happy path alone misses validation and authorization regressions.

## LAR-test-style

Use the project’s installed Pest or PHPUnit conventions.

Reason: Introducing a second runner or unsupported assertion breaks verification.

## LAR-factory-isolation

Create test state with factories and an isolated test database.

Reason: Tests must not depend on production data or execution order.
