# Security Policy

## Supported versions

Only the latest published version of `sanity-plugin-guided-tours` receives
security fixes.

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately via
[GitHub Security Advisories](https://github.com/frodeste/sanity-guided-tours/security/advisories/new)
or by email to **frode@stenstrom.no**. You can expect an acknowledgement within
a few days. Please include reproduction steps and the affected entry point
(Studio plugin, `/react` runtime, `/native` runtime, or `/queries`).

Areas of particular interest: the personalization token pipeline (tokens are
URL-controlled and must never reach `href`/`src` — see the design spec §8.3),
and the lead-capture form.
