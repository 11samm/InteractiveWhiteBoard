# Attributions

## tldraw

The canvas, shape model, undo/redo, camera, presence, and WebSocket sync engine come from the [tldraw SDK](https://tldraw.dev) (this project uses `tldraw` / `@tldraw/sync` 5.4.2).

tldraw is provided under the [tldraw license](https://tldraw.dev/community/license). Production deployments need a trial, hobby, or commercial license key. A hobby license keeps the “made with tldraw” watermark. This repository does not currently pass a `licenseKey` into `<Tldraw />`; local `npm run dev` is the intended demo.

Do not describe tldraw’s editor or synchronization as original work of this project.

## UI origin

The dark floating chrome started as a Figma Make file ([Dark-mode AI Whiteboard UI](https://www.figma.com/design/s1aJQH1S9a87LP8mhtnMlZ/Dark-mode-AI-Whiteboard-UI)) and was then rebuilt around tldraw and a Node host.

## Other

- [shadcn/ui](https://ui.shadcn.com/) components under [MIT](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)
- Photos from [Unsplash](https://unsplash.com) under the [Unsplash license](https://unsplash.com/license) (if still present in leftover assets)
- Google Gemini is called from the host with a key the operator supplies; it is not bundled
