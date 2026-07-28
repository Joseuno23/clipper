# Routes

Clipper now uses **React Router with one central route table** in
`src/router.tsx`. Files in this directory are page components imported by that
router; creating a `.tsx` file here does not automatically create a URL.

## Add or change a route

1. Create or edit the page component in `src/routes/<name>.tsx`.
2. Add the path and element in `src/router.tsx`.
3. Keep authenticated app screens wrapped in `AppShell`; keep `/login` outside
   the shell.
4. Add or update route behavior tests near `src/router.test.tsx` when the route
   contract changes.

## Conventions

| Route | URL/component | Notes |
| --- | --- | --- |
| `/` | `/dashboard` | Redirects with `<Navigate replace />`. |
| `/login` | `LoginPage` | Public screen; no `AppShell`. |
| App routes | `/dashboard`, `/appointments`, `/queue`, `/sales` | Render existing feature views inside `AppShell`. |
| Reports | `/reports/staff-liquidations`, `/reports/sales` | Render separated staff liquidation and sales report views inside `AppShell`; `/reports` redirects to staff liquidation. |
| Module stubs | `/customers`, `/services`, `/products`, `/staff`, `/settings` | Render preserved Lovable-generated stubs inside `AppShell`. |
| `*` | unknown paths | Renders the Spanish not-found screen with a dashboard link. |

There is no generated `routeTree.gen.ts`, TanStack Start root route, or
file-based router to edit.
