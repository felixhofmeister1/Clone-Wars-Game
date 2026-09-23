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

# VoxelCraft (`minecraft.html`)

A Minecraft Classic/Alpha-style voxel sandbox in **one self-contained HTML file**. It uses
Three.js r170 (ES modules plus `PointerLockControls`) and Tailwind CSS v4 (browser build),
both loaded from the jsDelivr CDN. The engine is vanilla JavaScript. Textures, icons and
sounds are generated at runtime, so there are no asset files.

## Run it

Open `minecraft.html` in a current browser (Chrome, Edge, Firefox or Safari with WebGL 2).
It works from the file system or any static server; with GitHub Pages it lives at
`/minecraft.html` next to the Clone Wars game. Touch devices are detected automatically and
get on-screen controls; you can override this in **Settings → Controls**. The world
auto-saves to `localStorage` (on pause, every 30 s and when the tab is hidden), and
**Continue World** on the title screen resumes it.

## Controls

| Action        | PC                                   | Mobile (touch)                                     |
|---------------|--------------------------------------|----------------------------------------------------|
| Move          | `W A S D` / arrows                   | Floating joystick (left side)                      |
| Look          | Mouse (pointer lock, raw input)      | Drag on the right side                             |
| Jump / swim   | `Space` (hold to keep jumping)       | ⤒ button                                           |
| Sneak         | `Shift` (no walking off edges)       | ⇊ toggle button                                    |
| Sprint        | `Ctrl` or double-tap `W`             | Push the joystick all the way forward              |
| Break         | Hold left click (crack animation)    | Break mode: hold still on the right side, or hold ⛏ |
| Place         | Right click (hold to repeat)         | Place mode: tap the right side, or tap ▣           |
| Pick block    | Middle click                         | —                                                  |
| Hotbar        | `1`–`9`, mouse wheel                 | Tap a slot                                         |
| Inventory     | `E`                                  | ▦ button                                           |
| Fly (creative)| Double-tap `Space` or `F`            | Double-tap ⤒ or the wing button                    |
| Pause         | `Esc`                                | ❚❚ button                                          |
| Debug overlay | `F3` (`F1` hides the HUD)            | —                                                  |

**Survival**: blocks are finite, harder blocks take longer to mine, and broken blocks go into
your inventory (grass drops dirt, stone drops cobblestone, glass drops nothing). **Creative**:
infinite blocks, instant breaking, flying, and a block palette in the inventory.

## How it works

| Class / part        | What it does |
|---------------------|--------------|
| Block registry      | IDs 0–7 (Air, Grass, Dirt, Stone, Oak Wood, Oak Leaves, Sand, Bedrock) plus Planks, Cobblestone, Glass, Bricks and Water. Each block defines collision, transparency, render type, sky-light filtering, hardness, per-face textures, sound and drop. The hot loops read flat `Uint8Array` lookup tables. |
| `TerrainGenerator`  | Seeded simplex noise. 2D continentalness, hills, ridged mountains, temperature and humidity give oceans, beaches, plains, forests, deserts and mountains. 3D noise adds mountain overhangs and "spaghetti" caves, sampled on a 4×4×4 lattice and interpolated. It layers grass or sand over dirt over stone, adds a jagged bedrock floor at Y=0–4, water to sea level, and oak trees that are consistent across chunk borders. |
| `Chunk` / `World`   | 16×256×16 chunks stored as `Uint8Array` (`y<<8 | z<<4 | x`) plus per-block vertical sky light. `World` streams chunks around the player, prioritises what's in front of the camera, unloads far chunks, handles block edits (instant re-mesh of touched sections, async re-mesh of light-affected neighbours), DDA raycasts and save data. |
| Web Worker pool     | Terrain generation and meshing run in 1–4 workers built from the same inline script; it falls back to the main thread if workers are unavailable. |
| `Mesher`            | Per 16³ section: floods sky light sideways and downward, then culls hidden faces, computes 4-corner ambient occlusion and smooth light, and greedily merges equal faces into large quads. Vertices are 8 bytes, textures come from a `DataArrayTexture` (repeat-wrapped, mipmapped), and every mesh shares one index buffer. Leaves have Fancy (see-through) and Fast modes. |
| `Renderer`          | Three.js WebGL renderer with custom block shaders (sky light × daylight, AO, fog, animated water). It does its own distance and frustum culling per chunk column and per section, and draws a gradient sky, sun, moon, stars, scrolling clouds, a day/night cycle, the block outline, break cracks and the first-person hand. It also has dynamic resolution. |
| `Physics`           | Player AABB 0.6×1.8, fixed 120 Hz sub-steps with render interpolation, swept per-axis collision (Y, then X, then Z) and a smoothed 1-block auto step-up. Gravity, air drag and a terminal velocity use frame-rate-independent exponential damping. It also covers sneak edge-guard, swimming and creative flight. |
| `InputManager`      | `PointerLockControls` for mouse look, plus keyboard, a floating joystick, a touch look zone and the action buttons, all feeding one set of normalised inputs. |
| `UI`                | Tailwind-styled title, loading, pause, settings and inventory screens (stack, split and shift-move like Minecraft), hotbar, toasts and the F3 overlay. |

Default render distance is 4 chunks on touch devices and 8 on PC (adjustable from 2 to 16).
Touch devices also default to Fast leaves, no MSAA, a capped pixel ratio and dynamic resolution.
The game's core layout CSS doesn't depend on Tailwind, so it stays playable if that CDN fails.
