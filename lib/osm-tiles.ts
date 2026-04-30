/**
 * OpenStreetMap slippy-map tile math.
 * Converts lat/lng to a tile (z, x, y) plus the pin's pixel offset within it.
 *
 * @see https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
 */
export interface TileLocation {
  tileX: number;
  tileY: number;
  pinXFraction: number; // 0..1 within the tile
  pinYFraction: number; // 0..1 within the tile
}

export function latLngToTile(lat: number, lng: number, zoom: number): TileLocation {
  const n = Math.pow(2, zoom);
  const xT = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yT =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const tileX = Math.floor(xT);
  const tileY = Math.floor(yT);
  return {
    tileX,
    tileY,
    pinXFraction: xT - tileX,
    pinYFraction: yT - tileY,
  };
}

export function tileUrl(zoom: number, x: number, y: number): string {
  // OSM public tile server. For heavier production traffic, switch to a
  // dedicated provider (MapTiler, Mapbox, …).
  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}
