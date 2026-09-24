# Condor A330neo Flight Simulator

A browser flight simulator of the **Condor Airbus A330-900neo**, flown between real Condor
airports (for example Frankfurt → Johannesburg) over streamed satellite imagery and real terrain.
Fly it from the captain's seat in a working A330 cockpit, or from outside in chase, drone,
tower, fly-by and cabin-window views.

Built with [three.js](https://threejs.org/) (r158) and plain JavaScript, with no build step.

## Run it

Open `index.html` in a desktop or mobile browser. It works straight from the file system
or from any static server:

```bash
cd condor-flight-sim
python3 -m http.server 8000     # then open http://localhost:8000
```

You need an internet connection: three.js, the fonts, the satellite imagery and the elevation
data load from public CDNs. If a scenery server can't be reached, the sim falls back
automatically, first to Sentinel-2 imagery, then to procedural scenery.

## What's inside

**Aircraft**
- A procedurally built A330-900neo with the five Condor 2022 stripe liveries:
  **Island** (green), **Sunshine** (yellow), **Passion** (red), **Sea** (blue) and **Beach** (sand).
  Each has the black lowercase *condor* wordmark and the condor signet on the fin.
- Moving parts: slats, Fowler flaps, spoilers and lift dumpers, two ailerons per side, elevators,
  trimmable horizontal stabiliser (THS), rudder, main gear (retracts inward) and nose gear
  (retracts forward) with oleo compression, steering and rolling wheels, spinning fans and
  translating reverser cowls.
- Lights: nav, strobes, beacons, landing/taxi and logo lights.

**Flight model** (`js/sim/fdm.js`)
- 6-degree-of-freedom rigid body on a spherical earth. Great-circle flights and the curvature of
  the earth come out naturally.
- A330-900 masses, inertias, wing area, Trent 7000 thrust lapse, spool-up and fuel flow; flap/slat
  configurations 0, 1, 1+F, 2, 3 and FULL with realistic VFE limits; ground effect, stall and
  transonic drag rise.
- Landing gear with oleos, tyre friction, brakes, autobrake LO/MED/MAX, nose-wheel steering and
  tiller, ground spoilers and reversers.
- **Airbus fly-by-wire normal law.** Sidestick pitch commands load factor and a neutral stick holds
  the flight path, with auto-trim. Sidestick roll commands roll rate and a neutral stick holds the
  bank angle up to 33°. Includes flare law, pitch-attitude, angle-of-attack (α-prot, α-floor),
  high-speed and bank-angle protections, and an optional direct law.

**Autoflight** (`js/sim/autoflight.js`)
- FCU with managed and selected speed, heading, altitude and V/S, plus AP1/AP2, A/THR, LOC and APPR.
- Flight mode annunciator (FMA) modes as on the aircraft:
  - A/THR: MAN TOGA / MAN FLX, THR CLB, THR IDLE, SPEED/MACH, A.FLOOR, LVR CLB
  - Vertical: SRS, CLB/OP CLB, ALT*/ALT/ALT CRZ, DES/OP DES, V/S, G/S*/G/S, LAND, FLARE, ROLL OUT
  - Lateral: RWY, NAV, HDG, LOC*/LOC
- Managed speeds: V1/VR/V2, green dot, S, F, VAPP, 250 kt below FL100, and M.82 in cruise.
- Great-circle flight plans with a departure fix, en-route waypoints, a CI/FF approach onto the
  ILS (with a downwind pattern when arriving from the far side), top of descent and a managed
  descent path.
- Warnings and callouts: PM callouts (Thrust set, 100 knots, V1, Rotate, Positive climb),
  radio-altitude callouts, RETARD, MINIMUM, GPWS (sink rate, pull up, too low gear/flaps,
  glideslope, bank angle), stall, overspeed, take-off config warnings, the AP-disconnect cavalry
  charge, seat-belt chimes and cabin announcements.

**Cockpit** (`js/cockpit/`)
- Captain's flight deck with live PFD, ND (ARC/ROSE), E/WD (N1, EGT, flaps, memos, warnings),
  SD (WHEEL/CRUISE pages), MCDU (F-PLN/PROG), FCU and EFIS panels.
- Clickable controls: left click pushes a knob, right click pulls it, the mouse wheel turns it.
  The gear lever, flaps, speed brake, thrust levers, autobrake and parking brake are clickable too.
- In outside views the same displays can be popped up as a 2D panel (▦ / `I`).

**World** (`js/world/`)
- Satellite imagery (Esri World Imagery, or Sentinel-2 cloudless) draped on real elevation data
  (AWS Terrain Tiles), streamed as a level-of-detail quadtree around the camera.
- 90 airports in the Condor network with every runway at its surveyed position: shader-drawn ICAO
  markings, edge, centreline, touchdown-zone and approach lights, sequenced flashers and working
  PAPIs. Airports are flattened to their real runway elevations, e.g. Johannesburg at 5,558 ft.
- Sun, sky and stars are computed from the real UTC time (or a time of day you pick), and time
  advances as you fly.
- Weather presets: calm, light winds, a 15 kt crosswind, or gusty 20G32. Winds aloft include the
  jet stream and trade winds.

## Controls

| Action | Keyboard | Phone / tablet |
|---|---|---|
| Sidestick | Arrow keys (↓ = pull), Shift for fine input | Left pad |
| Rudder / nose wheel | `Q` / `E` | ◀ ▶ |
| Thrust levers | `PgUp`/`PgDn` or `+`/`−`, detents `1` IDLE · `2` CL · `3` FLX/MCT · `4` TOGA | Right slider (snaps to detents) |
| Reverse thrust | hold `R` | REV |
| Flaps | `F` next notch, `Shift+F` previous | FLAP + / FLAP − |
| Gear | `G` | GEAR |
| Speed brake / arm spoilers | `/` / `Shift+/` | SPD BRK |
| Brakes / parking brake / autobrake | `B` or Space / `P` / `K` | BRAKE |
| Autopilot / autothrust / approach | `Z` / `Shift+Z` / `A` | AP / A/THR / APPR |
| FCU | `H` heading pull, `Shift+H` NAV, `[ ]` heading, `Home`/`End` altitude, `U` push altitude, `;` `'` speed, `V` V/S | ▦ panel |
| Views | `C` cockpit ⇄ outside, `X` cycle outside views, mouse drag / wheel | 👁 view button, drag |
| Time acceleration | `T` / `Shift+T` (up to 128× in cruise with the AP on) | − / + |

Gamepads and joysticks work through the Gamepad API. On a joystick, the trigger is the sidestick
takeover pushbutton (AP disconnect), and a throttle axis drives the thrust levers.

## A typical flight: Frankfurt → Johannesburg

1. In the planner, pick **FRA → JNB**, a livery and the load. The planner computes block fuel,
   take-off weight, V-speeds, flex temperature and the runways into wind.
2. **Take-off.** You start lined up with the parking brake set, flaps 1+F, spoilers armed and
   autobrake MAX. Release the parking brake (`P`), set FLX (`3`) and keep the centreline (`Q`/`E`).
   At "Rotate", pull gently to about 12.5° and follow the flight-director bars.
3. **Climb.** At "Positive climb" raise the gear (`G`). When LVR CLB flashes, move the levers to CL
   (`2`). Engage the autopilot (`Z`) and retract the flaps at the F and S speeds.
4. **Cruise.** The FMS flies the great circle over Africa at M.82. Use time acceleration, or ⏩ T/D
   to skip ahead.
5. **Descent.** At T/D, dial the altitude down (`End`) and push the knob (`U`) for a managed
   descent. Use the speed brake if the FMA shows MORE DRAG.
6. **Approach.** Arm APPR (`A`), then run the flaps 1 → 2 → 3 schedule, gear down, flaps FULL,
   spoilers armed and autobrake set. Either let it autoland, or disconnect (`Z`) and hand-fly the
   ILS into JNB's thin, hot-and-high air.
7. **Landing.** At "RETARD", set idle (`1`), then use reverse (`R`) and brakes. The landing report
   scores your touchdown rate, g-load, distance from the threshold and centreline deviation. Then
   fly the return leg.

You can also start **on final approach** (12 NM out) to practise landings, or **in cruise**.

## Project layout

```
index.html              page shell: planner, HUD, overlays, touch controls
css/sim.css             UI styles (mobile-first)
js/data/airports.js     Condor network airports & runways + magnetic variation grid (generated)
js/sim/geo.js           spherical-earth geodesy, great circles, Web-Mercator maths
js/sim/fdm.js           6DOF A330-900 flight model + fly-by-wire flight control computer
js/sim/flightplan.js    routes, runway/ILS geometry, descent profile, fuel planning
js/sim/autoflight.js    FMGC: FCU, AP/FD/A/THR modes, managed speeds, FWC callouts
js/world/frame.js       floating-origin render frame (ECEF -> local, double precision)
js/world/terrain.js     streamed imagery + elevation quadtree on the sphere
js/world/sky.js         sun position, sky dome, stars, lighting
js/world/airports3d.js  runways, markings, lights, PAPI
js/aircraft/liveries.js Condor stripe liveries (canvas textures)
js/aircraft/model.js    procedural A330-900neo with animated parts
js/cockpit/displays.js  PFD, ND, E/WD, SD, FCU, EFIS, MCDU drawing
js/cockpit/cockpit3d.js 3D flight deck and clickable controls
js/input.js             keyboard, gamepad/joystick and touch input
js/audio.js             synthesised engine/aero sounds, alerts and callouts
js/ui.js                flight planner, route map, reports
js/main.js              app: loop, views, commands, events
tools/build-airports.js regenerates js/data/airports.js from OurAirports
tests/                  headless Node tests (take-off, handling, complete flights)
```

Run the flight-model tests with Node 18+:

```bash
node tests/t_takeoff.js
node tests/t_handling.js
node tests/t_flight.js EDDF 25C FAOR 03L 37000 auto     # full FRA → JNB flight with autoland
node tests/t_flight.js EDDF 07C KJFK 31R 37000 manual   # hand-flown landing at JFK
```

## Data & credits

- Airports and runways: [OurAirports](https://ourairports.com/data/) (public domain).
- Elevation: [Terrain Tiles on AWS](https://registry.opendata.aws/terrain-tiles/) (Mapzen; SRTM,
  GMTED, ETOPO1 and other sources).
- Imagery: Esri World Imagery (© Esri, Maxar, Earthstar Geographics and the GIS User Community).
  Fallback: [Sentinel-2 cloudless 2016](https://s2maps.eu) by EOX IT Services GmbH (CC BY 4.0,
  contains modified Copernicus Sentinel data 2016).
- Fonts: [B612](https://github.com/polarsys/b612), the font designed for Airbus cockpit displays,
  and Barlow. Both from Google Fonts.
- Condor's route network is based on its recent published schedules and may not match the
  current timetable exactly.

This is a fan-made simulator for fun and learning. It isn't affiliated with or endorsed by
Condor Flugdienst GmbH or Airbus, and it isn't for real-world navigation or training.
