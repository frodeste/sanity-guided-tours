# examples/native

A minimal Expo (SDK 57) app rendering `sanity-plugin-guided-tours/native`'s
`<GuidedTour>` full-screen — the runnable counterpart to the
[React Native / Expo](../../README.md#react-native--expo) section of the root
README. `App.tsx` plain-`fetch`es the plugin's public demo project (project
`2xpymzdv`, dataset `production`, slug `demo-tour` — same content
[`examples/web`](../web) renders at `/tours/demo-tour`) using the exported
`tourProjection` query fragment, then renders the tour in a `SafeAreaView`
with `colorScheme="auto"`.

## Run locally

Like `examples/web`, this app depends on the plugin via `file:../..` and
needs the plugin's real `dist/` output — install and build from the
**repository root** first:

```bash
# from the repository root
bun install
bun run build

cd examples/native
bunx expo start
```

Scan the QR code with [Expo Go](https://expo.dev/go), or press `i`/`a` for a
simulator/emulator. There's no `.env` to configure — the demo project is
public-read, no token required (see `App.tsx`'s own comment).

## What CI runs

CI runs two checks against this example. `bun run typecheck` re-links
`node_modules/sanity-plugin-guided-tours` back to the repo root the same way
`examples/web`'s scripts do (`../../scripts/link-example-app.mjs`, generalized
in M8 Task 4 to work for either example directory) and runs `tsc --noEmit`.
Then `expo export --platform ios --platform android` produces a full Metro
bundle for both platforms — a pure local build, no Expo/EAS account or network
round-trip. Only running the app for real (`expo start` on a device or
simulator) is left to a human.

## v1 scope

The native viewer is a deliberate v1 subset of the web viewer — see the root
README's [React Native / Expo](../../README.md#react-native--expo) section
and design spec [§16](../../docs/superpowers/specs/2026-08-04-guided-tours-plugin-design.md#16-react-native--expo-runtime-added-2026-08-05).
