# Mothbun Goes to BLINK

A small side-scrolling pixel art game starring a friend's concrete rabbit lawn statue, dressed up as Mothman for a holiday. Level 1 is themed around BLINK, the Cincinnati and Covington light festival where artists project animations onto historic buildings.

## Character

"Mothbun" (also called bunmoth): a weathered, mossy concrete rabbit statue with long upright ears, glowing red eyes, and dark gray bat-like wings. Faces right; mirror for left.

## Art direction

- 32-bit-era pixel art, limited palette, 1-pixel dark outlines, no anti-aliasing.
- Night setting. Buildings are night color-graded with warm lit windows kept bright.
- Projections on buildings are drawn in code as animated colored light over the facades, not baked into the art. Buildings were generated dark and fairly flat so projected color reads well. Don't copy any real BLINK artist's work.
- All raw art was generated in ChatGPT on a solid #00FF00 background, then cleaned with the scripts in `tools/`.

## Layout

```
assets/character/mothbun_sheet.png   4 cols x 3 rows, 104x88 per frame
assets/character/mothbun_sheet.json  frame size, anchor, row map
assets/character/frames/             same frames as individual PNGs
assets/buildings/                    night-graded, transparent PNGs (use these)
assets/buildings/day/                original colors, for reference
raw/                                 original ChatGPT images with green backgrounds
tools/                               Python cleanup scripts (run from project root)
prototypes/                          two standalone HTML previews (assets embedded)
```

### Sprite sheet rows

- Row 0, walk: 4 frames. Legs barely change, reads as a stiff statue shuffle.
- Row 1, jump: crouch, launch, peak (wings spread wide), land. Frames 2 and 3 are airborne; lift them in code. The peak frame is much wider than the others, so base collision boxes on the body, not the frame.
- Row 2, idle: 4 nearly identical frames, a faint ear and wing twitch.

Frames are aligned horizontally on the red eye and vertically on the feet. The anchor in the JSON is the foot-baseline point under the eye.

### Buildings and scale

Rabbit standing height is about 86 px. Buildings are scaled relative to that (scale was increased once after feedback that they looked too small):

- house.png: 3.6x rabbit height (459x310). A Victorian house. Dropped from the level for now since it has no Cincinnati tie; files kept.
- music-hall.png: 4.9x (640x421). Cincinnati Music Hall, OTR.
- mother-of-god.png: 5.7x (401x490). Mother of God Church, Covington.
- museum-center.png: 3.6x (1071x310). Cincinnati Museum Center at Union Terminal. Rebuild one building with `python tools/clean_buildings.py museum-center` then `python tools/build_window_lights.py museum-center`.

The level-art-check prototype renders at an internal height of 560 art pixels, scaled to fit the screen height, with the width derived from the screen aspect ratio. Best viewed in landscape on a phone.

### Tools

- `tools/slice_character.py` then `tools/build_character_sheet.py`: detects each character on the raw sheet, finds the 4 px pixel grid, downscales, removes green fringe, aligns frames, writes the sheet, JSON, and frames.
- `tools/clean_buildings.py`: keys out green, scales each building to its multiple of rabbit height, quantizes to about 40 colors, writes night-graded and day versions. Edit the `specs` dict to change scale or grade strength.

Requires Python with Pillow, NumPy, and SciPy.

## Game design

- Auto-runner (confirmed): world scrolls on its own. Built for one-thumb phone play.
- Jump (tap), one double bounce per jump (tap again in the air), glide (hold, using the spread-wing frame), red-eye glare attack (code-drawn red beam that stuns).
- Obstacles are Cincinnati street annoyances, nothing else: e-scooter riders coming at Mothbun (two riders, `scooter` and `scooter-guy`, picked 50/50, each with 4 scooter color variants; jump them, or glare to wipe them out), a woman pushing a jogging stroller toward him (jump, or glare and she stops short, startled; drawn at the scooter's scale via `'stroller':('scooter',...)` in `clean_vehicles.py`; the green water bottle keys out to an outline), pedal wagons rolling the same way he runs but slower, and the streetcar driving toward him (land on either roof and run across; running into any vehicle costs a life, and the glare does nothing to them). The streetcar is rare and rings its bell as it comes on screen.
- Collect glowing light orbs from projections. Level ends at Mother of God Church with a final projection show.

## Status

Done:
- Character sprite sheet, cleaned and aligned.
- Buildings cleaned, scaled, and night-graded. `tools/build_window_lights.py` splits Music Hall and Mother of God into a lights-off facade, a lit-windows overlay, and window rects so the game switches windows on and off individually.
- Wings tinted indigo by `tools/recolor_wings.py` (reads the original gray sheet from `raw/character-gray/`).
- Roebling Bridge background layer (`tools/clean_bridge.py`), drawn at 0.35 parallax over a code-drawn river between Music Hall and Mother of God.
- Title logo (`raw/logo.png` cleaned by `tools/clean_logo.py` into `assets/ui/logo.png`, wings tinted the same indigo, ears recolored to concrete).
- Stage 1 game (Vite + TypeScript, plain canvas, no engine): title screen, auto-scroll, jump, hold to glide, code-drawn projections, window lights, light orbs, 3 lives, score and best score.

Code:
```
src/main.ts      loop, states (title, playing, finale, clear, over), drawing, HUD
src/tuning.ts    every gameplay number
src/audio.ts     synthesized sound effects
src/pixel-text.ts crisp pixel-font text for the title
src/rowhouses.ts code-drawn rowhouses between landmarks
src/building.ts  facade renderer: projections + per-window lights
src/player.ts    jump, glide, jump buffer, coyote time, body hitbox
src/world.ts     vehicle and orb spawning
src/input.ts     one-button input (tap, click, space, up)
src/assets.ts    asset loading
```
`assets/` is Vite's public dir and is served from the site root. Debug URL params: `?demo` plays itself, `?skip=<s>` fast-forwards the sim, `?t=<s>` offsets the projection clock.

Stage 2 done:
- Title is "Mothbun Goes to BLINK": bigger logo, pixel-font subtitle with BLINK letters cycling color (`src/pixel-text.ts`).
- Red-eye glare: on-screen eye button (bottom left) or X/F/Shift/Right. Knocks scooter riders off.
- Synthesized sound effects (`src/audio.ts`), mute button top right or M.
- Background music `assets/audio/music.mp3` ("Game 8-bit On" by moodmode, Pixabay, royalty-free). Starts on the first gesture, follows mute, pauses when the tab is hidden.
- Linear level with landmarks front-loaded for short plays: Music Hall at the start, Roebling Bridge around 4 to 19 s, Mother of God around 23 s, the Cincinnati Museum Center (Union Terminal, 3.6x rabbit height, 1071x310) around 27 s, then rowhouses, and Mother of God again at the end for the finale. New iconic buildings should go into the rowhouse stretch. Brakes to a stop, then a finale show with fireworks and a LEVEL CLEAR tally.
- Projections on the bridge towers (mask from hand-placed tower boxes in `tools/clean_bridge.py`).
- All gameplay numbers live in `src/tuning.ts`.
- Code-drawn Over-the-Rhine rowhouses (`src/rowhouses.ts`, seeded so the street is the same every run) fill the street between landmarks, leaving open space around Music Hall, the river by the bridge, and the church.
- Glare button enlarged (radius 42 art px, generous hit area) with a GLARE label for the first seconds of a run.

- Mothbun drawn at `playerScale` (1.25x the sheet, in `src/tuning.ts`); hitbox and eye scale with it.
- Vehicle sprites cleaned by `tools/clean_vehicles.py` from `raw/scooter.png`, `raw/pedal-wagon.png`, `raw/streetcar.png` into `assets/vehicles/` (frame strips plus JSON, night-graded, day versions in `day/`). In the game: scooter (4 ride frames + wipeout, 4 color variants as rows, made by `clean_vehicles.py`), pedal wagon (roof 140 px up), streetcar (roof 124 px up, art faces right so it's mirrored in code). A streetcar never comes right before or after a wagon, since they'd drive through each other. Finale fireworks are drawn behind the buildings. Hitboxes, roof heights, and which ones are platforms are in `KINDS` in `src/world.ts`; speeds are in `src/tuning.ts`. The world plans each vehicle by where Mothbun will meet it and spawns it off screen accordingly, since vehicles move. `Player.update` takes a `floor` (roof height he's on or above).
- The placeholder goose, cryptid hunter, and moth swarm are gone.

Still needed:
- Title-pose art, optionally a hurt frame. The streetcar art is teal; the real one may want a different livery.
- More set pieces for the long middle stretch, and on-device tuning feedback.

## Working style

Evan prefers staged development with a check-in after each meaningful piece, implementing only what's asked, and flagging changes as Small, Medium, or Large. For Large changes, outline the plan first. No emojis and no em dashes in responses.
