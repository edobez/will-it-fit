# Will it fit?

Browser parking simulator and Hybrid A* manoeuvre planner. Vite + TypeScript, no UI framework, canvas rendering.

- `npm run typecheck`, `npm test` and `npm run build` must pass before committing. Planner tests take about a minute.
- Keep `src/core`, `src/scenes` and `src/planner/search.ts` free of DOM access: they run in the worker and in Node tests.
- Recordings and plans share the `Sample` format in `src/trajectory.ts`; new trajectory sources should produce it too.
- `prototype/index.html` is the original single-file version, kept as a behavioural reference. Do not edit it.
- Planner changes: compare plans per scenario before and after (moves, length, min clearance, states explored) and update the move bounds in `tests/planner.test.ts` when a change improves them.
- Writing style for UI text and docs: sentence case, no em dashes.
