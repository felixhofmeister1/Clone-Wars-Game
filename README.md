# Clone Wars: Battle of Naboo

A browser-based 3D first-person shooter built with **Three.js** and vanilla JavaScript.
You play as a Phase I clone trooper holding a Theed palace courtyard against waves of
B1 battle droids.

## Run it

No build step and no install. Open `index.html` in a browser. It works straight from
the file system, or from any static server:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

Three.js (r158) and the fonts load from a CDN, so you need an internet connection.
To play on your phone, serve the folder from your computer and open
`http://<your-computer-ip>:8000` on a phone on the same Wi-Fi network. Rotate the phone to landscape.

## Controls

Pick **Mobile** or **PC** on the start screen. The game auto-detects the likely mode, and
you can switch at any time from the pause menu.

| Action  | Mobile (touch)                             | PC                 |
|---------|--------------------------------------------|--------------------|
| Move    | Left thumb: floating joystick              | `W A S D` / arrows |
| Sprint  | Push the joystick all the way forward      | `Shift`            |
| Aim     | Drag the right half of the screen          | Mouse (pointer lock) |
| Fire    | Hold **FIRE** (drag it to aim while firing) | Left click         |
| Reload  | ⟳ button                                   | `R`                |
| Jump    | ⤒ button (you can jump onto barricades)    | `Space`            |
| Pause   | ❚❚ button                                  | `Esc` / `P`        |

## Project structure

```
index.html        Page shell: canvas, helmet HUD, touch controls, menus
css/style.css     Phase I helmet HUD, crosshair, touch controls, menus (mobile-first)
js/utils.js       Math, segment/sphere/box collision, procedural stone textures
js/audio.js       Synthesised blaster/reload/explosion sounds + "Roger, roger" voice
js/controls.js    Unified input: pointer lock + keyboard, or virtual joystick + buttons
js/weapons.js     DC-15A view model, blaster bolts, muzzle flash, impacts, reloading
js/enemies.js     B1 battle droid model, marching/attack AI, waves, hit reactions, scoring
js/main.js        Renderer, Naboo courtyard, lighting, player movement, HUD, game loop
```

## Gameplay notes

- **Scoring:** 100 points per droid, 250 per yellow-marked commander, +50 for a headshot,
  and a bonus for clearing each wave. Your best score is saved in the browser.
- **Health and ammo:** clearing a wave restores 25 health and adds 60 power-cell rounds.
- **Cover:** droids can't hit you through stone, and they only fire when they can see you.

---

# Observable Universe Atlas (`universe/index.html`)

A second, independent app in this repository: a single-file, continuous 3D zoom from
alpine gravel at 10⁻¹ m to the cosmic microwave background at 10²⁶ m. Open
`universe/index.html` in a browser (or visit `/universe/` on the GitHub Pages site).
Three.js r160 and lil-gui load as ES modules from jsDelivr, so it needs an internet
connection and a WebGL 2 GPU.

| Tier | Scale | Contents |
|------|-------|----------|
| 1 | 10⁻¹ – 10⁴ m | Displaced alpine terrain with rock/soil/pebble shaders, Rayleigh + Mie sky, raymarched clouds |
| 2 | 10⁶ – 10⁹ m | Earth with real coastlines, night-side city lights, ocean glint, cloud shell, limb glow; the Moon on its computed orbit |
| 3 | 10¹⁰ – 10¹² m | Sun (granulation, prominences, flares, CMEs), inner planets, orbit trails, asteroid belt |
| 4 | 10¹² – 10¹⁶ m | Gas giants, Saturn's and Uranus's rings, Kuiper Belt, heliopause, Oort Cloud, Voyager 1 & 2 |
| 5 | 10¹⁶ – 10²¹ m | Named stars at catalogue positions; 200,000-particle Milky Way with differential rotation |
| 6 | 10²¹ – 10²⁴ m | Andromeda, Triangulum, Magellanic Clouds, dwarf galaxies, the Virgo Supercluster |
| 7 | 10²⁴ – 10²⁵ m | Cosmic web built on the GPU from a Voronoi tessellation, with real structures labelled |
| 8 | 10²⁶ m | CMB sphere from spherical-harmonic multipoles, cut open to show the web inside |

**Controls:** drag to orbit, scroll or pinch to zoom, double-click (double-tap) an object to
fly to it and lock on, `Esc` to release, `1`–`8` to jump between tiers, `Space` to pause
time, `L` labels, `O` orbit trails, `H` hide the HUD, `T` grand tour.

**How scale works:** every position is a float64 metre on the CPU. Each frame the focus
point is subtracted in double precision and the result is scaled so the focus sits one
render unit from the camera, then drawn with a logarithmic depth buffer. The GPU never
sees large coordinates, so there is no jitter at any zoom level.

**Data:** coastlines from Natural Earth (public domain, via `world-atlas`); night lights
derived from GeoNames city populations (CC BY 4.0, via `all-the-cities`); planet positions
from JPL's approximate Keplerian elements; star and galaxy positions from published
catalogue values. Terrain, clouds, planetary surfaces, galaxy particles and cosmic-web
filaments are procedural.
