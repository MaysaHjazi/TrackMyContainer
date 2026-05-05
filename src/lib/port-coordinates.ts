/**
 * Port and city coordinates lookup for displaying shipments on the world map.
 * Includes major ports (sea) and airports (air cargo hubs).
 *
 * Used to convert location strings (from tracking events) to lat/lng for
 * the 3D globe visualization.
 */

interface Coords { lat: number; lng: number }

const PORTS: Record<string, Coords> = {
  // ── Major Sea Ports ──
  "shanghai":     { lat: 31.2, lng: 121.5 },
  "singapore":    { lat: 1.3, lng: 103.8 },
  "rotterdam":    { lat: 51.9, lng: 4.5 },
  "dubai":        { lat: 25.3, lng: 55.3 },
  "los angeles":  { lat: 33.9, lng: -118.2 },
  "long beach":   { lat: 33.8, lng: -118.2 },
  "busan":        { lat: 35.1, lng: 129.0 },
  "new york":     { lat: 40.7, lng: -74.0 },
  "mumbai":       { lat: 19.1, lng: 72.9 },
  "sydney":       { lat: -33.9, lng: 151.2 },
  "santos":       { lat: -23.9, lng: -46.3 },
  "tokyo":        { lat: 35.7, lng: 139.7 },
  "yokohama":     { lat: 35.4, lng: 139.6 },
  "hamburg":      { lat: 53.5, lng: 9.9 },
  "antwerp":      { lat: 51.2, lng: 4.4 },
  "hong kong":    { lat: 22.3, lng: 114.2 },
  "shenzhen":     { lat: 22.5, lng: 114.1 },
  "ningbo":       { lat: 29.9, lng: 121.6 },
  "guangzhou":    { lat: 23.1, lng: 113.3 },
  "qingdao":      { lat: 36.1, lng: 120.4 },
  "tianjin":      { lat: 39.1, lng: 117.2 },
  "felixstowe":   { lat: 51.95, lng: 1.3 },
  "le havre":     { lat: 49.5, lng: 0.1 },
  "valencia":     { lat: 39.5, lng: -0.4 },
  "algeciras":    { lat: 36.1, lng: -5.4 },
  "piraeus":      { lat: 37.9, lng: 23.6 },
  "jeddah":       { lat: 21.5, lng: 39.2 },
  "salalah":      { lat: 17.0, lng: 54.0 },
  "colombo":      { lat: 6.9, lng: 79.9 },
  "port klang":   { lat: 3.0, lng: 101.4 },
  "tanjung pelepas": { lat: 1.4, lng: 103.5 },
  "kaohsiung":    { lat: 22.6, lng: 120.3 },
  "manila":       { lat: 14.6, lng: 121.0 },
  "santos brazil": { lat: -23.9, lng: -46.3 },
  "buenos aires": { lat: -34.6, lng: -58.4 },
  "callao":       { lat: -12.0, lng: -77.1 },
  "vancouver":    { lat: 49.3, lng: -123.1 },
  "savannah":     { lat: 32.1, lng: -81.1 },
  "norfolk":      { lat: 36.9, lng: -76.3 },
  "houston":      { lat: 29.7, lng: -95.0 },
  "miami":        { lat: 25.8, lng: -80.2 },
  "barcelona":    { lat: 41.3, lng: 2.2 },
  "genoa":        { lat: 44.4, lng: 8.9 },
  "copenhagen":   { lat: 55.7, lng: 12.6 },
  "stockholm":    { lat: 59.3, lng: 18.1 },
  "oslo":         { lat: 59.9, lng: 10.7 },
  "lagos":        { lat: 6.5, lng: 3.4 },
  "durban":       { lat: -29.9, lng: 31.0 },
  "alexandria":   { lat: 31.2, lng: 29.9 },
  "casablanca":   { lat: 33.6, lng: -7.6 },
  "izmir":        { lat: 38.4, lng: 27.1 },
  "istanbul":     { lat: 41.0, lng: 28.9 },

  // ── Major Airports / Air Cargo Hubs ──
  "doha":         { lat: 25.3, lng: 51.5 },
  "frankfurt":    { lat: 50.0, lng: 8.6 },
  "london":       { lat: 51.5, lng: -0.1 },
  "paris":        { lat: 49.0, lng: 2.5 },
  "amsterdam":    { lat: 52.3, lng: 4.8 },
  "memphis":      { lat: 35.0, lng: -90.0 },
  "louisville":   { lat: 38.2, lng: -85.7 },
  "chicago":      { lat: 41.9, lng: -87.9 },
  "anchorage":    { lat: 61.2, lng: -150.0 },
  "seoul":        { lat: 37.5, lng: 126.4 },
  "incheon":      { lat: 37.5, lng: 126.4 },
  "narita":       { lat: 35.8, lng: 140.4 },
  "bangkok":      { lat: 13.7, lng: 100.5 },
  "taipei":       { lat: 25.0, lng: 121.2 },
  "delhi":        { lat: 28.6, lng: 77.1 },

  // ── Sea regions / waterways for in-transit events ──
  "arabian sea":   { lat: 18.0, lng: 65.0 },
  "indian ocean":  { lat: -10.0, lng: 80.0 },
  "north atlantic ocean": { lat: 40.0, lng: -40.0 },
  "atlantic ocean": { lat: 20.0, lng: -40.0 },
  "north pacific ocean": { lat: 35.0, lng: -170.0 },
  "pacific ocean": { lat: 0.0, lng: -160.0 },
  "south china sea": { lat: 15.0, lng: 115.0 },
  "mediterranean sea": { lat: 38.0, lng: 18.0 },
  "red sea":       { lat: 20.0, lng: 38.0 },
  "suez canal":    { lat: 30.5, lng: 32.3 },
  "panama canal":  { lat: 9.0, lng: -79.5 },
  "english channel": { lat: 50.5, lng: 0.5 },
  "north sea":     { lat: 56.0, lng: 4.0 },
  "baltic sea":    { lat: 58.0, lng: 20.0 },
  "bay of biscay": { lat: 45.0, lng: -5.0 },
  "gulf of oman":  { lat: 25.0, lng: 58.0 },
  "gulf of guinea": { lat: 2.0, lng: 5.0 },

  // ── West Africa ──
  "tema":           { lat: 5.6, lng: -0.0 },   // Ghana
  "lome":           { lat: 6.1, lng: 1.2 },    // Togo
  "abidjan":        { lat: 5.3, lng: -4.0 },   // Ivory Coast
  "dakar":          { lat: 14.7, lng: -17.4 }, // Senegal
  "accra":          { lat: 5.6, lng: -0.2 },   // Ghana
  "cotonou":        { lat: 6.4, lng: 2.4 },    // Benin

  // ── South America ──
  "paranagua":      { lat: -25.5, lng: -48.5 }, // Brazil
  "rio de janeiro": { lat: -22.9, lng: -43.2 }, // Brazil
  "itajai":         { lat: -26.9, lng: -48.7 }, // Brazil
  "itapoa":         { lat: -26.1, lng: -48.6 }, // Itapoá, Brazil (Santa Catarina)
  "navegantes":     { lat: -26.9, lng: -48.6 }, // Brazil — sister port to Itajaí
  "montevideo":     { lat: -34.9, lng: -56.2 }, // Uruguay
  "guayaquil":      { lat: -2.2, lng: -79.9 },  // Ecuador

  // ── China extra ports ──
  "nansha":         { lat: 22.8, lng: 113.6 },  // Guangzhou, China
  "yantian":        { lat: 22.6, lng: 114.3 },  // Shenzhen, China
  "shekou":         { lat: 22.5, lng: 113.9 },  // Shenzhen, China
  "xiamen":         { lat: 24.5, lng: 118.1 },  // China
  "dalian":         { lat: 38.9, lng: 121.6 },  // China

  // ── East Africa ──
  "mombasa":        { lat: -4.0, lng: 39.7 },   // Kenya
  "dar es salaam":  { lat: -6.8, lng: 39.3 },   // Tanzania
  "maputo":         { lat: -25.9, lng: 32.6 },  // Mozambique
  "djibouti":       { lat: 11.6, lng: 43.1 },   // Djibouti

  // ── Middle East extra ──
  "abu dhabi":      { lat: 24.5, lng: 54.4 },
  "sohar":          { lat: 24.3, lng: 56.6 },   // Oman
  "bandar abbas":   { lat: 27.2, lng: 56.3 },   // Iran
  "umm qasr":       { lat: 29.9, lng: 48.0 },   // Iraq
  "strait of malacca": { lat: 3.0, lng: 100.0 },
  "in transit":    { lat: 0.0, lng: 30.0 },

  // ── Asia (extra coverage) ──
  "jakarta":       { lat: -6.2, lng: 106.8 },
  "surabaya":      { lat: -7.2, lng: 112.7 },
  "ho chi minh":   { lat: 10.8, lng: 106.7 },
  "haiphong":      { lat: 20.9, lng: 106.7 },
  "chittagong":    { lat: 22.3, lng: 91.8 },
  "karachi":       { lat: 24.9, lng: 67.0 },
  "chennai":       { lat: 13.1, lng: 80.3 },
  "kolkata":       { lat: 22.6, lng: 88.4 },
  "tuticorin":     { lat: 8.8, lng: 78.1 },
  "yangon":        { lat: 16.8, lng: 96.2 },
  "phnom penh":    { lat: 11.6, lng: 104.9 },
  "fuzhou":        { lat: 26.1, lng: 119.3 },
  "cebu":          { lat: 10.3, lng: 123.9 },

  // ── Middle East / North Africa extra ──
  "cairo":         { lat: 30.0, lng: 31.2 },
  "port said":     { lat: 31.3, lng: 32.3 },
  "ain sokhna":    { lat: 29.6, lng: 32.3 },
  "damietta":      { lat: 31.4, lng: 31.8 },
  "aqaba":         { lat: 29.5, lng: 35.0 },
  "haifa":         { lat: 32.8, lng: 35.0 },
  "ashdod":        { lat: 31.8, lng: 34.6 },
  "beirut":        { lat: 33.9, lng: 35.5 },
  "lattakia":      { lat: 35.5, lng: 35.8 },
  "mersin":        { lat: 36.8, lng: 34.6 },
  "kuwait":        { lat: 29.4, lng: 47.9 },
  "doha port":     { lat: 25.3, lng: 51.5 },
  "muscat":        { lat: 23.6, lng: 58.6 },
  "tunis":         { lat: 36.8, lng: 10.2 },
  "algiers":       { lat: 36.8, lng: 3.1 },
  "tangier":       { lat: 35.8, lng: -5.8 },

  // ── Europe extra ──
  "marseille":     { lat: 43.3, lng: 5.4 },
  "naples":        { lat: 40.8, lng: 14.3 },
  "gioia tauro":   { lat: 38.4, lng: 15.9 },
  "trieste":       { lat: 45.6, lng: 13.8 },
  "bilbao":        { lat: 43.3, lng: -3.0 },
  "lisbon":        { lat: 38.7, lng: -9.1 },
  "porto":         { lat: 41.1, lng: -8.6 },
  "constanta":     { lat: 44.2, lng: 28.6 },
  "gdansk":        { lat: 54.4, lng: 18.7 },
  "klaipeda":      { lat: 55.7, lng: 21.1 },
  "helsinki":      { lat: 60.2, lng: 24.9 },
  "saint petersburg": { lat: 59.9, lng: 30.3 },
  "novorossiysk":  { lat: 44.7, lng: 37.8 },

  // ── Americas extra ──
  "seattle":       { lat: 47.6, lng: -122.3 },
  "oakland":       { lat: 37.8, lng: -122.3 },
  "manzanillo":    { lat: 19.0, lng: -104.3 }, // Mexico
  "veracruz":      { lat: 19.2, lng: -96.1 },
  "altamira":      { lat: 22.4, lng: -97.9 },
  "kingston":      { lat: 18.0, lng: -76.8 },
  "freeport":      { lat: 26.5, lng: -78.7 },
  "cartagena":     { lat: 10.4, lng: -75.5 },
  "puerto cabello": { lat: 10.5, lng: -68.0 },
  "balboa":        { lat: 9.0, lng: -79.6 },
  "san antonio":   { lat: -33.6, lng: -71.6 }, // Chile
  "valparaiso":    { lat: -33.0, lng: -71.6 },
  "iquique":       { lat: -20.2, lng: -70.1 },

  // ── Africa extra ──
  "tema port":     { lat: 5.6, lng: 0.0 },
  "luanda":        { lat: -8.8, lng: 13.2 },
  "walvis bay":    { lat: -22.9, lng: 14.5 },
  "cape town":     { lat: -33.9, lng: 18.4 },
  "port elizabeth": { lat: -33.9, lng: 25.6 },
  "toamasina":     { lat: -18.1, lng: 49.4 },

  // ── Oceania ──
  "melbourne":     { lat: -37.8, lng: 144.9 },
  "brisbane":      { lat: -27.4, lng: 153.0 },
  "auckland":      { lat: -36.8, lng: 174.8 },
  "tauranga":      { lat: -37.7, lng: 176.2 },
};

/**
 * Find lat/lng for a location string (port, airport, sea, city).
 * Tries exact match first, then partial substring match.
 * Returns { lat: 0, lng: 0 } if not found (won't crash the map).
 */
export function getCoordinates(location?: string | null): Coords {
  if (!location) return { lat: 0, lng: 0 };

  const normalized = location.toLowerCase().trim();

  // Exact match
  if (PORTS[normalized]) return PORTS[normalized];

  // Partial match — find first key that's contained in the location string
  for (const [key, coords] of Object.entries(PORTS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return coords;
    }
  }

  return { lat: 0, lng: 0 };
}
