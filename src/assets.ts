export type Rect = [x: number, y: number, w: number, h: number];

export interface SheetMeta {
  frameWidth: number;
  frameHeight: number;
  anchor: { x: number; y: number };
  rows: { walk: number; jump: number; idle: number };
}

export interface BuildingArt {
  name: BuildingName;
  dark: HTMLImageElement;
  lights: HTMLImageElement;
  windows: Rect[];
}

export const BUILDINGS = ['music-hall', 'mother-of-god'] as const;
export type BuildingName = (typeof BUILDINGS)[number];

export interface Assets {
  sheet: HTMLImageElement;
  meta: SheetMeta;
  logo: HTMLImageElement;
  bridge: HTMLImageElement;
  buildings: Record<BuildingName, BuildingArt>;
}

const url = (path: string) => import.meta.env.BASE_URL + path;

function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${path}`));
    img.src = url(path);
  });
}

async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(url(path));
  if (!res.ok) throw new Error(`Could not load ${path}`);
  return res.json() as Promise<T>;
}

async function loadBuilding(name: BuildingName): Promise<BuildingArt> {
  const [dark, lights, windows] = await Promise.all([
    loadImage(`buildings/${name}-dark.png`),
    loadImage(`buildings/${name}-lights.png`),
    loadJson<Rect[]>(`buildings/${name}-windows.json`),
  ]);
  return { name, dark, lights, windows };
}

export async function loadAssets(): Promise<Assets> {
  const [sheet, meta, logo, bridge, ...buildings] = await Promise.all([
    loadImage('character/mothbun_sheet.png'),
    loadJson<SheetMeta>('character/mothbun_sheet.json'),
    loadImage('ui/logo.png'),
    loadImage('buildings/roebling.png'),
    ...BUILDINGS.map(loadBuilding),
  ]);
  return {
    sheet,
    meta,
    logo,
    bridge,
    buildings: Object.fromEntries(buildings.map((b) => [b.name, b])) as Record<BuildingName, BuildingArt>,
  };
}
