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

## Also in this repo: Family Portal

[`family-portal/`](family-portal/) is a separate, installable family web app. It has a shared calendar, realtime chat, kudos and a shop, a 3D family island, and a multiplayer arcade with Battleships, Pool and Poker. It runs on Supabase, or in a built-in demo mode that needs no setup. See [`family-portal/README.md`](family-portal/README.md).
