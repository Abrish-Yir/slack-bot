require("dotenv").config();
const { App } = require("@slack/bolt");
const { getLocalPlanes } = require("./radar");
require("dotenv").config();
const axios = require("axios"); 

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true
});


app.command("/dsb-ping", async ({ command, ack, respond }) => {
  const start = Date.now();
  
  await ack();
  
  const latency = Date.now() - start;
  await respond({ text: `Pong!\nLatency: ${latency}ms` });
});

(async () => {
  // Start your app
  await app.start();
  console.log("⚡️ Bot is running!");
})();
app.command("/radar", async ({ command, ack, respond }) => {
  await ack(); 
  
  // command.text captures whatever is typed after the command name
  const targetCity = command.text.trim() || "London";
  
  await respond({ text: `Scanning skies over ${targetCity}... ` });
  
  const flightReport = await getLocalPlanes(targetCity);
  
  await respond({ text: flightReport });
});
// A completely separate feature - does not change the /radar command!
app.command("/alert", async ({ command, ack, respond }) => {
  await ack();
  
  await respond({ text: "Checking your local proximity grid... " });
  
  // We hardcode the tight box around your area coordinates right here
  const lamin = 8.95; 
  const lomin = 38.70; 
  const lamax = 9.05; 
  const lomax = 38.80;

  const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

  try {
    const fetch = require("node-fetch");
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.states || data.states.length === 0) {
      await respond({ text: " Skies are quiet directly overhead right now." });
      return;
    }

    let coolPlanes = [];

    data.states.forEach((plane) => {
      const callsign = plane[1].trim() || "UNKNOWN";
      const country = plane[2];
      const altitude = Math.round(plane[7] || 0);
      const onGround = plane[8];

      let isCool = false;
      let coolReason = "";

      // Filter Logic for a "Cool" Plane:
      if (altitude > 11000) {
        isCool = true;
        coolReason = " Cruising at extreme high altitude!";
      } else if (altitude < 2500 && !onGround) {
        isCool = true;
        coolReason = " Low altitude flyover / landing phase!";
      } else if (callsign.startsWith("ETH") || callsign.startsWith("UAE") || callsign.startsWith("QTR")) {
        isCool = true;
        coolReason = " Major International Airliner";
      }

      if (isCool) {
        coolPlanes.push(`• *${callsign}* (${country})\n  Altitude: ${altitude}m | *Reason:* ${coolReason}`);
      }
    });

    if (coolPlanes.length === 0) {
      await respond({ text: ` Detected ${data.states.length} standard aircraft nearby, but none matched your "cool plane" filters.` });
    } else {
      await respond({ text: ` *PROXIMITY ALERT: Cool Aircraft Overhead!* \n\n${coolPlanes.join("\n\n")}` });
    }

  } catch (error) {
    console.error(error);
    await respond({ text: " Failed to scan regional proximity radar." });
  }
});
// Help Menu Command
app.command("/dsb-help", async ({ ack, respond }) => {
  await ack();
  await respond({
    text: `Available Commands:\n/dsb-ping - Check bot latency\n/dsb-catfact - Get a random cat fact\n/radar - Scan global skies`
  });
});

// Cat Fact Command
app.command("/dsb-catfact", async ({ ack, respond }) => {
  await ack();

  try {
    // Axios reaches out to the cat api web address
    const response = await axios.get("https://catfact.ninja/fact");
    // response.data.fact contains the text string we want
    await respond({ text: ` *Cat Fact:* ${response.data.fact}` });
  } catch (err) {
    console.error(err);
    await respond({ text: " Failed to fetch a cat fact." });
  }
});