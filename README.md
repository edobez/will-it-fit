# Will it fit?

A browser simulator and manoeuvre planner for parking a car in tight spaces: a garage off a narrow tunnel, parallel slots, perpendicular or angled bays. Enter your car's dimensions and the space, drive it yourself from the top view or a driver view, or let the planner find a manoeuvre and turn it into step-by-step instructions.

**Live:** https://edobez.github.io/will-it-fit/ (once GitHub Pages is enabled for the repository)

## Features

- **Two views side by side:** a top view with the world fixed, and a driver view with the car fixed and heading up.
- **Manual driving:** arrow keys or the on-screen pad. The wheel stays where you leave it, as in a real car, and contact stops the car.
- **Projections:** where the centre, the corners and the mirrors go at the current steering angle, forward and reverse. Either stop at the first contact or pass through and mark the overlap.
- **Clearance:** live smallest gap to anything, with the closest part of the car (mirror, corner, wheel).
- **Scenarios:** garage off a tunnel, parallel parking on a street (curbs only stop the wheels, bodywork may overhang) or underground, perpendicular and angled bays, all with editable dimensions.
- **Reachability heatmap:** everywhere the car can get in one move without changing direction.
- **Planner:** Hybrid A* with direction changes, steering mainly at stops, a safety margin, a clearance preference and an optional nose-in or reversed-in goal. Runs in a Web Worker.
- **Timeline:** recording of your drive and the planned manoeuvre, with steering and clearance plots, replay with a ghost car, "continue from here", and a list of steps such as "Reverse 3.00 m, wheel full lock right · min 12 cm (rear right corner)".

## Development

Requires Node 22.

```sh
npm install
npm run dev        # local dev server
npm test           # unit and planner tests (the planner tests take about a minute)
npm run typecheck
npm run build      # static site in dist/
```

## Structure

```
src/
  core/        pure geometry, kinematics, vehicle footprint, collision and clearance
  scenes/      scenario definitions and builders
  sim/         world state, manual driving, projections, reachability heatmap
  planner/     Hybrid A* search (pure function), worker entry, conversion to trajectories
  timeline/    recording, playhead, plot, steps card
  render/      view transforms and drawing
  ui/          settings panel, controls, HUD
  trajectory.ts  the shared trajectory format used by recordings and plans
prototype/     the original single-file prototype, kept as a behavioural reference
tests/         Vitest tests
```

`core/`, `scenes/` and `planner/search.ts` have no DOM dependencies, so they run unchanged in the worker and in the tests.

## Model and limitations

- Kinematic bicycle model around the rear axle, no tyre slip, walking speed.
- The maximum wheel angle is derived from the curb to curb turning circle and the track width.
- Heights are ignored except that curbs are treated as low: only the tyres collide with them.
- The planner searches a lattice (0.15 m, 3°, 0.5 m steps, five steering levels; finer in "fine" mode) with a weighted heuristic. It is fast but not strictly optimal, and "no solution" means none was found on that lattice.

## Licence

MIT, see [LICENSE](LICENSE).
