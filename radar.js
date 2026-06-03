const fetch = require("node-fetch");

// Helper function to turn a city name into map boundaries
async function getCityBounds(cityName) {
  const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&limit=1`;
  
  const response = await fetch(geoUrl, {
    headers: { "User-Agent": "SlackRadarBot/1.0" } // Required by OpenStreetMap terms
  });
  const data = await response.json();

  if (!data || data.length === 0) return null;

  // Nominatim returns a boundingbox array: [minLat, maxLat, minLon, maxLon]
  const bbox = data[0].boundingbox;
  
  return {
    lamin: parseFloat(bbox[0]),
    lamax: parseFloat(bbox[1]),
    lomin: parseFloat(bbox[2]),
    lomax: parseFloat(bbox[3]),
    displayName: data[0].display_name.split(",")[0] // Just get the city name
  };
}

async function getLocalPlanes(cityName) {
  try {
    // 1. Convert city name to dynamic coordinates
    const bounds = await getCityBounds(cityName);
    if (!bounds) {
      return `❌ Could not find a city named "${cityName}". Check the spelling!`;
    }

    // 2. Fetch planes matching those dynamic coordinates
    const skyUrl = `https://opensky-network.org/api/states/all?lamin=${bounds.lamin}&lomin=${bounds.lomin}&lamax=${bounds.lamax}&lomax=${bounds.lomax}`;
    const response = await fetch(skyUrl);
    const data = await response.json();
    
    if (!data.states || data.states.length === 0) {
      return `🛩️ Skies are clear over *${bounds.displayName}* right now. No transponders active.`;
    }

    // 3. Build the live flight tracking report
    let report = `✈️ *Live Radar: ${bounds.displayName} Airspace* (${data.states.length} total)\n`;
    data.states.slice(0, 5).forEach((plane) => {
      const callsign = plane[1].trim() || "UNKNOWN";
      const country = plane[2];
      const altitude = Math.round(plane[7] || 0);
      
      report += `• *Callsign:* ${callsign} | *Owner Country:* ${country} | *Alt:* ${altitude}m\n`;
    });

    return report;

  } catch (error) {
    console.error(error);
    return "⚠️ System error fetching live radar or map data.";
  }
}

module.exports = { getLocalPlanes };