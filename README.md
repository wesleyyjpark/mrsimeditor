# Track Editor for MRSIM

Drag-and-drop track editor for MRSIM. The UI is built with React + Vite +
TypeScript; the canvas is rendered with [Fabric.js](http://fabricjs.com/).

Made by Wesley (wesleyfpv)

## Running locally

You need [Node.js](https://nodejs.org/) (18+) and `npm`.

```bash
npm install
npm run dev
```

Vite will open the editor at `http://localhost:5173`.

### Other scripts

```bash
npm run build       # type-check then bundle into ./dist
npm run preview     # preview the production bundle locally
npm run typecheck   # run tsc --noEmit
```

## Project layout

```
src/
  App.tsx               # root component, owns the CanvasController lifecycle
  main.tsx              # React entrypoint
  canvas/
    CanvasController.ts # imperative Fabric.js logic (selection, snapping, IO)
    controllerContext.tsx
  components/           # UI panels and layout
  data/                 # object catalog, indicator config, icon paths
  store/editorStore.ts  # Zustand store for shared UI state
  types/                # shared TS types
  utils/                # pure helpers (math, file IO, editor metadata)
  styles/index.css      # all styles
assets/                 # static images / SVG diagrams (served by Vite)
legacy/                 # previous vanilla JS implementation, kept for reference
```

`legacy/` contains the previous vanilla HTML/CSS/JS implementation. It is no
longer wired up to the build, but is kept for reference and can still be served
with `python -m http.server` from inside that folder.

## Features

- Drag-and-drop placement of gates, cubes, ladders, poles, hurdles, etc.
- Snapping (toggleable) with configurable grid size and rotation snap.
- Pan with `Space` + drag (or middle-/right-click), zoom with mouse wheel.
- Hold `Shift` while moving an object to disable snapping temporarily.
- Ruler tool for measuring planar distance.
- Reference launch pad / mat / canopies for orientation.
- Per-object inspector with altitude, attachment options (poles to gates or
  cubes), and a "Gate Indicator" SVG diagram for picking checkpoint faces.
- Global "Gate Order" view for editing the checkpoint sequence.
- XML import / export compatible with MRSIM track XML format, including
  preservation of editor metadata in `EditorMeta:` comments.
