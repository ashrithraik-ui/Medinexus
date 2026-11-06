export interface GeoLocationItem {
  id: string;
  name: string;
  city: "Bangalore" | "Mysore" | "Other";
  state: string;
  coords: [number, number];
  aliases: string[];
  type?: "landmark" | "locality" | "city_center" | "hospital" | "transit";
}

export const KARNATAKA_LOCATIONS: GeoLocationItem[] = [
  // --- CITY CENTERS ---
  {
    id: "blr-center",
    name: "Bangalore City Center (Vidhana Soudha / MG Road)",
    city: "Bangalore",
    state: "Karnataka",
    coords: [12.9716, 77.5946],
    aliases: ["bangalore", "bengaluru", "blr", "bangalore city", "central bangalore"],
    type: "city_center",
  },
  {
    id: "myq-center",
    name: "Mysore City Center (Mysore Palace)",
    city: "Mysore",
    state: "Karnataka",
    coords: [12.3054, 76.6551],
    aliases: ["mysore", "mysuru", "myq", "mysore city", "central mysore", "mysore palace"],
    type: "city_center",
  },

  // --- BANGALORE LOCALITIES & LANDMARKS ---
  {
    id: "blr-koramangala",
    name: "Koramangala (Sony World Junction / 5th Block)",
    city: "Bangalore",
    state: "Karnataka",
    coords: [12.9352, 77.6245],
    aliases: ["koramangala", "sony world", "koramangala 5th block", "koramangala 4th block", "forum mall"],
    type: "locality",
  },
  {
    id: "blr-indiranagar",
    name: "Indiranagar (100ft Road / CMH Road)",
    city: "Bangalore",
    state: "Karnataka",
    coords: [12.9719, 77.6412],
    aliases: ["indiranagar", "100ft road", "cmh road", "indiranagar metro", "12th main"],
    type: "locality",
  },
  {
    id: "blr-mg-road",
    name: "MG Road & Trinity Circle",
    city: "Bangalore",
    state: "Karnataka",
    coords: [12.9756, 77.6066],
    aliases: ["mg road", "trinity circle", "brigade road", "church street", "cubbon park"],
    type: "landmark",
  },
  {
    id: "blr-hsr",
    name: "HSR Layout (BDA Complex / Sector 1-7)",
    city: "Bangalore",
    state: "Karnataka",
    coords: [12.9116, 77.6389],
    aliases: ["hsr", "hsr layout", "hsr bda complex", "hsr sector 1", "hsr sector 2"],
    type: "locality",
  },
  {
    id: "blr-whitefield",
    name: "Whitefield (ITPL / Hope Farm)",
    city: "Bangalore",
    state: "Karnataka",
    coords: [12.9863, 77.737],
    aliases: ["whitefield", "itpl", "hope farm", "kadugodi", "ecoworld"],
    type: "locality",
  },
  {
    id: "blr-ecity",
    name: "Electronic City Phase 1 & 2",
    city: "Bangalore",
    state: "Karnataka",
    coords: [12.8452, 77.6602],
    aliases: ["electronic city", "e-city", "ecity", "electronic city phase 1", "infosys gate ecity"],
    type: "locality",
  },
  {
    id: "blr-bannerghatta",
    name: "Bannerghatta Road (Opp. IIM-B)",
    city: "Bangalore",
    state: "Karnataka",
    coords: [12.895, 77.598],
    aliases: ["bannerghatta road", "bannerghatta", "iim-b", "iim bangalore", "arekere", "hulimavu"],
    type: "locality",
  },
  {
    id: "blr-btm",
    name: "BTM Layout (Udupi Garden / 2nd Stage)",
    city: "Bangalore",
    state: "Karnataka",
    coords: [12.9165, 77.6101],
    aliases: ["btm", "btm layout", "udupi garden", "btm 2nd stage", "madiwala"],
    type: "locality",
  },
  {
    id: "blr-jayanagar",
    name: "Jayanagar (4th Block Shopping Complex)",
    city: "Bangalore",
    state: "Karnataka",
    coords: [12.9298, 77.5838],
    aliases: ["jayanagar", "jayanagar 4th block", "south end circle", "jayanagar bda"],
    type: "locality",
  },
  {
    id: "blr-jp-nagar",
    name: "JP Nagar (Phase 1-6 / Ring Road)",
    city: "Bangalore",
    state: "Karnataka",
    coords: [12.9063, 77.5857],
    aliases: ["jp nagar", "jayaprakash nagar", "jp nagar 2nd phase", "sarakki"],
    type: "locality",
  },
  {
    id: "blr-hebbal",
    name: "Hebbal (Hebbal Flyover / Manyata Tech Park)",
    city: "Bangalore",
    state: "Karnataka",
    coords: [13.0358, 77.597],
    aliases: ["hebbal", "hebbal flyover", "manyata", "manyata tech park", "nagawara"],
    type: "locality",
  },
  {
    id: "blr-majestic",
    name: "Majestic (KSR Bangalore Railway Station / Kempegowda Bus Station)",
    city: "Bangalore",
    state: "Karnataka",
    coords: [12.9783, 77.5714],
    aliases: ["majestic", "kempegowda bus station", "ksr bangalore", "bangalore railway station"],
    type: "transit",
  },
  {
    id: "blr-marathahalli",
    name: "Marathahalli (Multiplex / ORR Junction)",
    city: "Bangalore",
    state: "Karnataka",
    coords: [12.9591, 77.6974],
    aliases: ["marathahalli", "marathahalli bridge", "outer ring road", "kalamandir"],
    type: "locality",
  },
  {
    id: "blr-bellandur",
    name: "Bellandur (EcoSpace / Central Mall)",
    city: "Bangalore",
    state: "Karnataka",
    coords: [12.9304, 77.6784],
    aliases: ["bellandur", "ecospace", "bellandur gate", "green glen layout"],
    type: "locality",
  },
  {
    id: "blr-malleswaram",
    name: "Malleswaram (8th Cross / Margosa Road)",
    city: "Bangalore",
    state: "Karnataka",
    coords: [13.0031, 77.5643],
    aliases: ["malleswaram", "8th cross", "sampige road", "margosa road"],
    type: "locality",
  },
  {
    id: "blr-rajajinagar",
    name: "Rajajinagar (Navrang Circle / Orion Mall)",
    city: "Bangalore",
    state: "Karnataka",
    coords: [12.9982, 77.553],
    aliases: ["rajajinagar", "navrang circle", "orion mall", "isckon bangalore"],
    type: "locality",
  },
  {
    id: "blr-yelahanka",
    name: "Yelahanka (New Town / Airport Road)",
    city: "Bangalore",
    state: "Karnataka",
    coords: [13.1007, 77.5963],
    aliases: ["yelahanka", "yelahanka new town", "yelahanka air force", "kogilu"],
    type: "locality",
  },
  {
    id: "blr-victoria",
    name: "Victoria Hospital / KR Market (BMCRI)",
    city: "Bangalore",
    state: "Karnataka",
    coords: [12.9629, 77.5746],
    aliases: ["victoria hospital", "kr market", "city market", "bmcri", "fort bangalore"],
    type: "hospital",
  },
  {
    id: "blr-domlur",
    name: "Domlur / Intermediate Ring Road (EGL)",
    city: "Bangalore",
    state: "Karnataka",
    coords: [12.961, 77.639],
    aliases: ["domlur", "egl", "embassy golf links", "intermediate ring road", "command hospital"],
    type: "locality",
  },
  {
    id: "blr-airport",
    name: "Kempegowda International Airport (BLR)",
    city: "Bangalore",
    state: "Karnataka",
    coords: [13.1986, 77.7066],
    aliases: ["airport", "bangalore airport", "kia", "kempegowda airport", "devanahalli"],
    type: "transit",
  },

  // --- MYSORE LOCALITIES & LANDMARKS ---
  {
    id: "myq-palace",
    name: "Mysore Palace North Gate",
    city: "Mysore",
    state: "Karnataka",
    coords: [12.3054, 76.6551],
    aliases: ["mysore palace", "palace gate", "mysore palace north gate", "chamaraja circle"],
    type: "landmark",
  },
  {
    id: "myq-kr-circle",
    name: "K.R. Circle (Sayyaji Rao Road / Devaraja Market)",
    city: "Mysore",
    state: "Karnataka",
    coords: [12.3101, 76.6518],
    aliases: ["kr circle", "k.r. circle", "sayyaji rao road", "devaraja market", "kr circle mysore"],
    type: "landmark",
  },
  {
    id: "myq-railway",
    name: "Mysore Railway Station Circle",
    city: "Mysore",
    state: "Karnataka",
    coords: [12.3148, 76.6492],
    aliases: ["railway station", "mysore railway station", "station circle", "medar block"],
    type: "transit",
  },
  {
    id: "myq-ballal",
    name: "Ballal Circle (Krishnamurthypuram)",
    city: "Mysore",
    state: "Karnataka",
    coords: [12.3015, 76.645],
    aliases: ["ballal circle", "krishnamurthypuram", "ballal circle mysore"],
    type: "landmark",
  },
  {
    id: "myq-kuvempunagar",
    name: "Kuvempunagar (Complex / Double Road)",
    city: "Mysore",
    state: "Karnataka",
    coords: [12.298, 76.626],
    aliases: ["kuvempunagar", "kuvempunagar complex", "vishwamanava double road"],
    type: "locality",
  },
  {
    id: "myq-saraswathipuram",
    name: "Saraswathipuram (Fire Brigade Junction)",
    city: "Mysore",
    state: "Karnataka",
    coords: [12.308, 76.634],
    aliases: ["saraswathipuram", "fire brigade mysore", "kukkarahalli lake"],
    type: "locality",
  },
  {
    id: "myq-jayalakshmipuram",
    name: "Jayalakshmipuram (Kalidasa Road)",
    city: "Mysore",
    state: "Karnataka",
    coords: [12.321, 76.628],
    aliases: ["jayalakshmipuram", "kalidasa road", "vontikoppal"],
    type: "locality",
  },
  {
    id: "myq-gokulam",
    name: "Gokulam 3rd Stage (Doctor's Corner)",
    city: "Mysore",
    state: "Karnataka",
    coords: [12.3315, 76.632],
    aliases: ["gokulam", "gokulam 3rd stage", "doctors corner gokulam", "yoga ashram"],
    type: "locality",
  },
  {
    id: "myq-bannimantap",
    name: "Bannimantap (Torchlight Parade Ground / Highway Circle)",
    city: "Mysore",
    state: "Karnataka",
    coords: [12.335, 76.651],
    aliases: ["bannimantap", "highway circle", "torchlight ground", "nelson mandela road"],
    type: "locality",
  },
  {
    id: "myq-vijayanagar",
    name: "Vijayanagar Mysore (Water Tank / Club)",
    city: "Mysore",
    state: "Karnataka",
    coords: [12.338, 76.608],
    aliases: ["vijayanagar mysore", "vijayanagar 1st stage", "vijayanagar water tank"],
    type: "locality",
  },
  {
    id: "myq-jss",
    name: "JSS Hospital Mysore (Ramanuja Road)",
    city: "Mysore",
    state: "Karnataka",
    coords: [12.3005, 76.654],
    aliases: ["jss hospital", "jss hospital mysore", "ramanuja road"],
    type: "hospital",
  },
  {
    id: "myq-infosys",
    name: "Infosys Mysore Campus / Hebbal Industrial Area",
    city: "Mysore",
    state: "Karnataka",
    coords: [12.361, 76.595],
    aliases: ["infosys mysore", "hebbal mysore", "infosys campus", "hebbal industrial area"],
    type: "locality",
  },
  {
    id: "myq-chamundi",
    name: "Chamundi Hill (Temple / Viewpoint)",
    city: "Mysore",
    state: "Karnataka",
    coords: [12.274, 76.671],
    aliases: ["chamundi hill", "chamundeshwari temple", "bull temple mysore", "viewpoint"],
    type: "landmark",
  },
];

/**
 * Fast search in the local Karnataka directory.
 * Matches exact, startsWith, substring, and alias lookups.
 */
export function searchLocalLocations(query: string, maxResults = 6): GeoLocationItem[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return KARNATAKA_LOCATIONS.slice(0, maxResults);

  // Check if specific city names are requested
  const matches: { item: GeoLocationItem; score: number }[] = [];

  for (const loc of KARNATAKA_LOCATIONS) {
    let score = 0;
    const nameLower = loc.name.toLowerCase();
    const cityLower = loc.city.toLowerCase();

    // Exact city or name match gets highest score
    if (nameLower === clean || cityLower === clean) {
      score += 100;
    } else if (nameLower.startsWith(clean)) {
      score += 50;
    } else if (nameLower.includes(clean)) {
      score += 30;
    }

    // Check aliases
    for (const alias of loc.aliases) {
      if (alias === clean) {
        score += 80;
        break;
      } else if (alias.startsWith(clean)) {
        score += 40;
        break;
      } else if (alias.includes(clean)) {
        score += 20;
        break;
      }
    }

    if (score > 0) {
      matches.push({ item: loc, score });
    }
  }

  // Sort descending by match score
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, maxResults).map((m) => m.item);
}

/**
 * Resolves a text query to coordinates.
 * Supports:
 * 1. "lat, lng" coordinate format (e.g. "12.9716, 77.5946")
 * 2. Instant matching against Karnataka directory
 * 3. Fallback to OpenStreetMap Nominatim for free-text geocoding
 */
export async function resolveLocationCoords(query: string): Promise<{
  coords: [number, number];
  displayName: string;
  city: "Bangalore" | "Mysore" | "Other";
  source: "coordinates" | "directory" | "nominatim" | "default";
}> {
  const clean = query.trim();
  if (!clean) {
    return {
      coords: [12.9352, 77.6245],
      displayName: "Koramangala 5th Block, Bangalore",
      city: "Bangalore",
      source: "default",
    };
  }

  // 1. Direct coordinate format: "12.9716, 77.5946" or "12.9716 77.5946"
  const coordMatch = clean.match(/^([0-9.-]+)[\s,]+([0-9.-]+)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      const city = lat >= 12.75 && lat <= 13.25 && lng >= 77.35 && lng <= 77.85 ? "Bangalore" : lat >= 12.2 && lat <= 12.45 && lng >= 76.5 && lng <= 76.8 ? "Mysore" : "Other";
      return {
        coords: [lat, lng],
        displayName: `${city !== "Other" ? city + " Coordinates" : "Custom Coordinates"} (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        city,
        source: "coordinates",
      };
    }
  }

  // 2. High-speed local directory search
  const localResults = searchLocalLocations(clean, 1);
  if (localResults.length > 0) {
    const top = localResults[0];
    return {
      coords: top.coords,
      displayName: `${top.name}, ${top.city}`,
      city: top.city,
      source: "directory",
    };
  }

  // 3. Fallback to OpenStreetMap Nominatim geocoder
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      clean + ", Karnataka, India"
    )}&format=json&limit=1`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "Accept-Language": "en" },
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        const item = json[0];
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        if (!isNaN(lat) && !isNaN(lng)) {
          const isBlr = lat >= 12.75 && lat <= 13.25 && lng >= 77.35 && lng <= 77.85;
          const isMyq = lat >= 12.2 && lat <= 12.45 && lng >= 76.5 && lng <= 76.8;
          const city = isBlr ? "Bangalore" : isMyq ? "Mysore" : "Other";
          return {
            coords: [lat, lng],
            displayName: item.display_name.split(",").slice(0, 3).join(","),
            city,
            source: "nominatim",
          };
        }
      }
    }
  } catch (err) {
    console.warn("Nominatim geocode fallback timed out or failed:", err);
  }

  // 4. Default fallback
  const isMysoreMentioned = clean.toLowerCase().includes("mysor") || clean.toLowerCase().includes("mysur");
  if (isMysoreMentioned) {
    return {
      coords: [12.3054, 76.6551],
      displayName: "Mysore City Center",
      city: "Mysore",
      source: "default",
    };
  }

  return {
    coords: [12.9352, 77.6245],
    displayName: `${clean} (Bangalore Area)`,
    city: "Bangalore",
    source: "default",
  };
}

/**
 * Accurate Haversine distance in kilometers.
 */
export function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Reverse lookup to label pinned coordinates with nearest locality or city.
 */
export function reverseLookupCoords(lat: number, lng: number): {
  name: string;
  city: "Bangalore" | "Mysore" | "Other";
} {
  let closest: GeoLocationItem | null = null;
  let minDistance = Infinity;

  for (const loc of KARNATAKA_LOCATIONS) {
    const dist = calculateHaversineKm(lat, lng, loc.coords[0], loc.coords[1]);
    if (dist < minDistance) {
      minDistance = dist;
      closest = loc;
    }
  }

  const isBlr = lat >= 12.75 && lat <= 13.25 && lng >= 77.35 && lng <= 77.85;
  const isMyq = lat >= 12.2 && lat <= 12.45 && lng >= 76.5 && lng <= 76.8;
  const city = isBlr ? "Bangalore" : isMyq ? "Mysore" : "Other";

  if (closest && minDistance <= 3.0) {
    return {
      name: `Near ${closest.name}`,
      city: closest.city,
    };
  }

  return {
    name: `${city !== "Other" ? city : "Pinned Point"} (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    city,
  };
}


