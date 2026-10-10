import { makeCanvas } from './building';

// Renders text with the pixel font at its native size, snaps it to hard pixels, and
// adds a 1 px dark outline. Scale the result up with smoothing off to keep it crisp.
export function pixelText(str: string, size: number, font: string): HTMLCanvasElement {
  const [, measure] = makeCanvas(1, 1);
  measure.font = `${size}px ${font}`;
  const w = Math.ceil(measure.measureText(str).width) + 2;
  const h = size + 2;
  const [c, ctx] = makeCanvas(w, h);
  ctx.font = `${size}px ${font}`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff';
  ctx.fillText(str, 1, 1);

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const on = new Uint8Array(w * h);
  for (let i = 0; i < on.length; i++) on[i] = d[i * 4 + 3] > 110 ? 1 : 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let px: number[] = [0, 0, 0, 0];
      if (on[i]) px = [255, 255, 255, 255];
      else
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < w && ny < h && on[ny * w + nx]) px = [11, 9, 20, 255];
          }
      d.set(px, i * 4);
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Recolors the white pixels of a pixelText canvas. The dark outline stays dark.
export function tint(src: HTMLCanvasElement, color: string, out?: HTMLCanvasElement): HTMLCanvasElement {
  const c = out ?? makeCanvas(src.width, src.height)[0];
  const ctx = c.getContext('2d')!;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  return c;
}
