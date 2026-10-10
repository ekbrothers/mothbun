from PIL import Image; import numpy as np
from scipy import ndimage as nd
# Roebling Bridge background layer. Keys out the green, snaps the art to its ~3.4 px
# pixel grid, quantizes, and night-grades everything but the lamps and cable lights.
# The source is cut off on the right, so that edge fades out with an ordered dither.
GRID = 3.4
FADE = 56  # art px
im = np.array(Image.open('raw/roebling.png').convert('RGB')).astype(float)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
a = nd.binary_opening(~((g > 140) & (g > r + 50) & (g > b + 50)), iterations=1)
edge = a & nd.binary_dilation(~a, iterations=3)
mx = np.maximum(r, b)
im[..., 1] = np.where(edge & (g > mx), mx, g)
ys, xs = np.where(a)
im = im[ys.min():ys.max() + 1, xs.min():xs.max() + 1]; a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
W, H = round(a.shape[1] / GRID), round(a.shape[0] / GRID)
s = np.array(Image.fromarray(np.uint8(np.dstack([im * a[..., None], a * 255])), 'RGBA').resize((W, H), Image.BOX)).astype(float)
al = s[..., 3] / 255
rgb = np.where(al[..., None] > 0, s[..., :3] / np.maximum(al[..., None], 1e-6), 0)
rgb = np.array(Image.fromarray(np.uint8(np.clip(rgb, 0, 255))).quantize(colors=40, method=Image.Quantize.MEDIANCUT).convert('RGB')).astype(float)
alpha = al > 0.5

R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
lit = (R > 190) & (G > 120) & (R > B + 90)
night = rgb * np.array([0.5, 0.5, 0.75]) + np.array([8, 6, 22])
rgb = np.where(lit[..., None], rgb, night)

bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16
xx = np.arange(W)[None, :].repeat(H, 0)
keep = np.clip((W - 1 - xx) / FADE, 0, 1) > bayer[np.arange(H)[:, None] % 4, xx % 4]
alpha &= keep

Image.fromarray(np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8), 'RGBA').save('assets/buildings/roebling.png')
print('roebling', W, H)
