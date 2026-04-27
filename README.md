# Track Editor for MRSIM 
Made by Wesley (wesleyfpv)

URL FOR ACCESS: 
[MRSIM EDITOR](https://mrsimeditor.wesleyyjpark.workers.dev/)

### Top-down track editor for MRSIM. 

Built as a project to get me some more web dev experience and create tracks in MRSIM
without having to fiddle with XML and coordinate stuff. I prioritize track building speed
over a 3d environment.

The UI is built with React, Vite, and TypeScript
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

Known Issues:
- You can't see the previous pole sensor orientation after you add a checkpoint and change it
- All the champ size gates and hurdles are inaccurate when placed down


TO DO LIST
- fix gate snapping to the grid properly not just y axis
- icons for gate order
- make favorites work
- Allow gate face changes, gate sensing on gate stacks

## Project layout

```
mrsimeditor/
├── assets/                          # Static images and svg diagrams
├── src/
│   ├── App.tsx                      # root component, owns the CanvasController lifecycle
│   ├── canvas/
│   │   └── CanvasController.ts      # Fabric.js logic (selection, snapping, IO)
│   ├── components/                  # UI panels and layout
│   │   └── ui/
│   ├── data/                        # object catalog, indicator config, icon paths
│   ├── hooks/
│   ├── lib/
│   │   └── utils.ts
│   ├── main.tsx                     # React entrypoint
│   ├── store/                        # Zustand store for shared UI state
│   ├── styles/                      # all styles
│   ├── types/                       # shared TS types
│   ├── utils/                       # pure helpers (math, file IO, editor metadata)
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
