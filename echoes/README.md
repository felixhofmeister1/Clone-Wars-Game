# Echoes in the Drywall

A short first-person horror game for phone and computer. The last tenant recorded something
living inside the walls of this apartment. Find the three cassette tapes, then get out.
The thing in the drywall moves through walls and hunts by sound.

## Play

Open `index.html` in a browser, or serve the folder and open it:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

Three.js (r158) and two Google Fonts load from CDNs; every sound is synthesized in the browser.
Use headphones: sound tells you where it is.

| Action       | Computer            | Phone                                       |
|--------------|---------------------|---------------------------------------------|
| Move         | W A S D / arrows    | Left thumb joystick                         |
| Sneak        | C                   | Push the stick lightly                      |
| Run          | Shift               | Push the stick fully                        |
| Look         | Mouse               | Drag the right side of the screen           |
| Flashlight   | F                   | LIGHT                                       |
| Hold breath  | Hold Space          | Hold BREATH                                 |
| Pause        | Esc / P             | II                                          |

## How it works

- **It hunts by sound.** Walking carries about 4.5 m, running 10 m, sneaking 1.4 m. Calm
  breathing carries 1.8 m and panicked breathing up to 3.2 m. The NOISE meter shows how far you
  carry. It only takes you when it is beside you *and* can hear you, so standing still and
  holding your breath lets it pass.
- **Holding your breath** lasts 6 seconds when calm, less when scared. Run out, or let go while
  panicking, and you gasp, which it hears across most of the apartment.
- **The flashlight** runs on a draining battery. It flickers harder, dims and drops out as the
  charge runs low. Batteries are lying around. Catching it in the beam will spike your panic.
- **The apartment changes when you are not looking.** Some walls are only walls while you face
  them.
- **Every 30 seconds or so** something makes a sound 3.5 m behind you, and the low drone cuts to
  total silence for 4.5 seconds.

## Files

```
index.html      Page: canvas, HUD, touch controls, title / pause / end screens
style.css       Visual design (single dark theme, phone and desktop layouts)
js/systems.js   Flashlight battery + Perlin flicker, breathing and panic, the look-away shift trigger
js/audio.js     Web Audio engine (drone, 3D one-shots, scratching) and the behind-you audio director
js/world.js     Apartment layout, procedural drywall textures, furniture, pickups, exit, collision
js/entity.js    The thing in the drywall: wandering, hunting by sound, listening, retreating
js/input.js     Keyboard and mouse (pointer lock or drag), touch joystick, look and buttons
js/game.js      Game loop, rules, HUD, hints and screens
```

The systems in `js/systems.js` and the audio director are browser ports of the Unreal Engine 5
C++ classes in `../EchoesInTheDrywall/`, using the same tuning values.
