import L from 'leaflet';

export const MAPTILER_API_KEY = 'xQga0tRTTPoq7upvYp7f';
export const MAPTILER_OUTDOOR_URL = `https://api.maptiler.com/maps/outdoor-v4/256/{z}/{x}/{y}.png?key=${MAPTILER_API_KEY}`;
export const OSM_FALLBACK_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const ESRI_SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const ESRI_LABELS_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

export const CACHE_NAME = 'app-maptiler-tile-cache-v1';

export interface CachedTileLayerOptions extends L.TileLayerOptions {
  fallbackUrl?: string;
  enableTileCaching?: boolean;
}

/**
 * Creates a high-performance Cached Tile Layer using the browser's CacheStorage API.
 * Intercepts every Leaflet tile request:
 * 1. Serves directly from browser CacheStorage (instant local response, zero API calls).
 * 2. If tile is not in cache, fetches it and stores the blob in cache.
 * 3. If MapTiler key is restricted, rate-limited, or network is offline, seamlessly falls back
 *    to OpenStreetMap tiles so the map NEVER breaks with blank tiles.
 */
export function createCachedTileLayer(
  urlTemplate: string,
  options: CachedTileLayerOptions = {}
): L.TileLayer {
  const { fallbackUrl, enableTileCaching = true, ...layerOptions } = options;

  const CachedTileLayerClass = (L.TileLayer as any).extend({
    createTile(coords: L.Coords, done: (error?: any, tile?: HTMLImageElement) => void) {
      const tile = document.createElement('img');
      tile.setAttribute('role', 'presentation');
      tile.setAttribute('crossOrigin', 'anonymous');

      const url = this.getTileUrl(coords);

      const handleImageLoad = (src: string, isObjectUrl = false) => {
        tile.onload = () => {
          if (isObjectUrl) {
            URL.revokeObjectURL(src);
          }
          done(undefined, tile);
        };
        tile.onerror = () => {
          if (isObjectUrl) {
            URL.revokeObjectURL(src);
          }
          if (fallbackUrl && src !== fallbackUrl) {
            const sub = ['a', 'b', 'c'][Math.abs(coords.x + coords.y) % 3];
            const fb = fallbackUrl
              .replace('{z}', String(coords.z))
              .replace('{x}', String(coords.x))
              .replace('{y}', String(coords.y))
              .replace('{s}', sub);
            handleImageLoad(fb, false);
          } else {
            done(new Error('Tile load error'), tile);
          }
        };
        tile.src = src;
      };

      // If caching is disabled or Cache API is not supported
      if (!enableTileCaching || typeof window === 'undefined' || !('caches' in window)) {
        handleImageLoad(url, false);
        return tile;
      }

      caches
        .open(CACHE_NAME)
        .then((cache) => {
          return cache.match(url).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse
                .blob()
                .then((blob) => {
                  const objectUrl = URL.createObjectURL(blob);
                  handleImageLoad(objectUrl, true);
                })
                .catch(() => {
                  handleImageLoad(url, false);
                });
            }

            // Fetch tile and save clone in cache
            return fetch(url, { mode: 'cors' })
              .then((res) => {
                if (!res.ok) {
                  throw new Error(`Tile fetch returned HTTP ${res.status}`);
                }
                const clone = res.clone();
                cache.put(url, clone).catch(() => {});
                return res.blob();
              })
              .then((blob) => {
                const objectUrl = URL.createObjectURL(blob);
                handleImageLoad(objectUrl, true);
              })
              .catch(() => {
                // If MapTiler fetch failed (e.g. 403 or network offline), fallback gracefully
                if (fallbackUrl) {
                  const sub = ['a', 'b', 'c'][Math.abs(coords.x + coords.y) % 3];
                  const fb = fallbackUrl
                    .replace('{z}', String(coords.z))
                    .replace('{x}', String(coords.x))
                    .replace('{y}', String(coords.y))
                    .replace('{s}', sub);
                  handleImageLoad(fb, false);
                } else {
                  handleImageLoad(url, false);
                }
              });
          });
        })
        .catch(() => {
          handleImageLoad(url, false);
        });

      return tile;
    },
  });

  return new CachedTileLayerClass(urlTemplate, layerOptions);
}

/**
 * Returns current count of cached map tiles in CacheStorage
 */
export async function getCachedTileCount(): Promise<number> {
  if (typeof window === 'undefined' || !('caches' in window)) return 0;
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    return keys.length;
  } catch {
    return 0;
  }
}

/**
 * Clears the map tile cache
 */
export async function clearTileCache(): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false;
  try {
    return await caches.delete(CACHE_NAME);
  } catch {
    return false;
  }
}
