from PIL import Image; import numpy as np, json
from scipy import ndimage as nd
# Tints the wing membranes on the character sheet. Reads the original gray sheet from
# raw/character-gray/ and writes assets/character/mothbun_sheet.png plus frames/.
# Wings are the large low-saturation gray regions in each frame; the inner ears and
# body shadows are similar grays but small, so they are left alone.
DARK, LIGHT = (14, 10, 34), (78, 58, 140)  # indigo, from shadow to highlight

meta = json.load(open('assets/character/mothbun_sheet.json'))
FW, FH = meta['frameWidth'], meta['frameHeight']
im = np.array(Image.open('raw/character-gray/mothbun_sheet.png').convert('RGBA')).astype(float)
R, G, B, A = im[..., 0], im[..., 1], im[..., 2], im[..., 3]
lum = R * 0.3 + G * 0.59 + B * 0.11
sat = im[..., :3].max(-1) - im[..., :3].min(-1)
strict = (A > 0) & (lum > 30) & (lum < 118) & (sat < 28)
loose = (A > 0) & (lum > 12) & (lum < 118) & (sat < 30)

seed = np.zeros_like(strict)
for fy in range(0, im.shape[0], FH):
    for fx in range(0, im.shape[1], FW):
        c = strict[fy:fy + FH, fx:fx + FW]
        lab, n = nd.label(c, structure=np.ones((3, 3)))
        if n:
            sizes = nd.sum(c, lab, range(1, n + 1))
            seed[fy:fy + FH, fx:fx + FW] = np.isin(lab, 1 + np.where(sizes >= 120)[0])
wing = nd.binary_propagation(seed, structure=np.ones((3, 3)), mask=loose)
wing |= nd.binary_closing(wing, iterations=1) & loose

t = np.clip((lum - 15) / 100, 0, 1)[..., None]
tint = np.array(DARK) + (np.array(LIGHT) - np.array(DARK)) * t
im[..., :3] = np.where(wing[..., None], tint, im[..., :3])
sheet = Image.fromarray(np.uint8(im), 'RGBA')
sheet.save('assets/character/mothbun_sheet.png')
cols = sheet.width // FW
for i, name in enumerate(meta['frames']):
    x, y = (i % cols) * FW, (i // cols) * FH
    sheet.crop((x, y, x + FW, y + FH)).save(f'assets/character/frames/{name}')
print('wing px', int(wing.sum()))
