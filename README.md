# Track Editor for MRSIM 
Made by Wesley (wesleyfpv)

Top-down track editor for MRSIM. The UI is built with React, Vite, and TypeScript
The canvas is rendered with fabric

## Features

- Drag-and-drop placement of gates
- Toggle snapping with configurable grid size and rotation snap
- Pan with `Space` + drag (or middle-/right-click), zoom with mouse wheel.
- Hold `Shift` while moving an object to disable snapping temporarily.
- Ruler tool for measuring planar distance. (will update to a better ruler display soon)
- W.I.P Reference launch pad / mat / canopies for orientation. (will update graphic)
- Per-object inspector with altitude, attachment options (poles to gates or
  cubes), and a "Gate Indicator" SVG diagram for picking checkpoint faces.
- Global "Gate Order" view for editing the checkpoint sequence.
- XML import / export to MRSIM XML format, including
  preservation of editor metadata in `EditorMeta:` comments.

TO DO LIST
- make snapping into a button for user visibility
- add pole sensing 
- drag around reorder gate order
- icons for gate order
- fix gate palette icon sizing

## Project layout

```
|src/
|              App.tsx               # root component, owns the CanvasController lifecycle
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


## Running locally

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


`legacy/` contains the previous vanilla HTML/CSS/JS implementation. I chose to overhaul the UI and refactor the code base to become more maintainable once this project grows. It is no
longer wired up to the build, but is kept for reference and can still be served
with `python -m http.server` from inside that folder.
