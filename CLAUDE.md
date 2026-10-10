# Mothbun

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

- house.png: 3.6x rabbit height (459x310). A Victorian house; its role in the level is not yet decided.
- music-hall.png: 4.9x (640x421). Cincinnati Music Hall, OTR.
- mother-of-god.png: 5.7x (401x490). Mother of God Church, Covington.

The level-art-check prototype renders at an internal height of 560 art pixels, scaled to fit the screen height, with the width derived from the screen aspect ratio. Best viewed in landscape on a phone.

### Tools

- `tools/slice_character.py` then `tools/build_character_sheet.py`: detects each character on the raw sheet, finds the 4 px pixel grid, downscales, removes green fringe, aligns frames, writes the sheet, JSON, and frames.
- `tools/clean_buildings.py`: keys out green, scales each building to its multiple of rabbit height, quantizes to about 40 colors, writes night-graded and day versions. Edit the `specs` dict to change scale or grade strength.

Requires Python with Pillow, NumPy, and SciPy.

## Proposed game design (not yet confirmed by Evan)

- Auto-runner: world scrolls on its own. Built for one-thumb phone play.
- Jump (tap), glide (hold, using the spread-wing frame), red-eye glare attack (code-drawn red beam that stuns).
- Enemies: cryptid hunters with flashlights and cameras (getting photographed costs a life), moths swarming toward projections, geese or raccoons as ground obstacles.
- Collect glowing light orbs from projections. Level ends at Mother of God Church with a final projection show.

## Status

Done:
- Character sprite sheet, cleaned and aligned.
- Three buildings, cleaned, scaled, and night-graded.
- Two HTML prototypes (animation preview, scrolling level art check).

Open questions:
- Auto-runner vs free left/right movement (auto-runner recommended).
- Whether the Victorian house is the friends' house where the statue lives (possible level start).

Still needed:
- Game code (Stage 1: auto-scroll, jump, glide, code-driven projections, placeholder enemy blocks).
- Assets: tileable street strip, distant skyline layer, obstacle set, enemy sprites, optionally a hurt frame.

## Working style

Evan prefers staged development with a check-in after each meaningful piece, implementing only what's asked, and flagging changes as Small, Medium, or Large. For Large changes, outline the plan first. No emojis and no em dashes in responses.
