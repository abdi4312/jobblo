const mongoose = require("mongoose");
const dotenv = require("dotenv");
const NorwayCounty = require("../models/NorwayCounty");
const NorwayMunicipality = require("../models/NorwayMunicipality");
const NorwayArea = require("../models/NorwayArea");

dotenv.config();

const KARTVERKET_BASE_URL = "https://api.kartverket.no/kommuneinfo/v1";
const SSB_BASE_URL = "https://data.ssb.no/api/klass/v1";

// Function to walk through SSB data and extract all codes/names
function walkSSBData(value, found = []) {
  if (Array.isArray(value)) {
    value.forEach((v) => walkSSBData(v, found));
  } else if (value && typeof value === "object") {
    const code = value.code || value.kode || value.id || value.value;
    const name =
      value.name ||
      value.navn ||
      value.title ||
      value.label ||
      value.presentationName;
    if (typeof code === "string" && typeof name === "string") {
      found.push({ code, name });
    }
    Object.values(value).forEach((v) => walkSSBData(v, found));
  }
  return found;
}

async function seedLocations() {
  try {
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://localhost:27017/jobblo",
    );
    console.log("Connected to MongoDB");

    // Clear existing data
    await NorwayCounty.deleteMany({});
    await NorwayMunicipality.deleteMany({});
    await NorwayArea.deleteMany({});
    console.log("Cleared existing location data");

    // 1. Fetch counties and municipalities from Kartverket
    console.log("Fetching counties and municipalities from Kartverket...");
    const kartverketResponse = await fetch(
      `${KARTVERKET_BASE_URL}/fylkerkommuner`,
    );
    const countiesData = await kartverketResponse.json();

    const countiesToInsert = [];
    const municipalitiesToInsert = [];

    countiesData.forEach((county) => {
      countiesToInsert.push({
        code: county.fylkesnummer,
        name: county.fylkesnavn,
      });

      (county.kommuner || []).forEach((municipality) => {
        municipalitiesToInsert.push({
          code: municipality.kommunenummer,
          countyCode: county.fylkesnummer,
          name: municipality.kommunenavn,
        });
      });
    });

    await NorwayCounty.insertMany(countiesToInsert);
    await NorwayMunicipality.insertMany(municipalitiesToInsert);
    console.log(
      `Inserted ${countiesToInsert.length} counties and ${municipalitiesToInsert.length} municipalities`,
    );

    // 2. Fetch areas (bydeler) from SSB
    console.log("Fetching areas from SSB...");
    const ssbResponse = await fetch(`${SSB_BASE_URL}/versions/1168.json`);
    const ssbData = await ssbResponse.json();

    const allAreas = walkSSBData(ssbData);

    // Filter areas for Oslo, Bergen, Trondheim, Stavanger (cities with bydeler)
    const areasToInsert = [];
    const municipalityCodes = municipalitiesToInsert.map((m) => m.code);

    allAreas.forEach((area) => {
      // Find which municipality this area belongs to (by code prefix)
      for (const municipalityCode of municipalityCodes) {
        if (area.code.startsWith(municipalityCode)) {
          areasToInsert.push({
            code: area.code,
            municipalityCode: municipalityCode,
            name: area.name,
          });
          break;
        }
      }
    });

    // Remove duplicates
    const uniqueAreas = [];
    const seenCodes = new Set();
    areasToInsert.forEach((area) => {
      if (!seenCodes.has(area.code)) {
        seenCodes.add(area.code);
        uniqueAreas.push(area);
      }
    });

    await NorwayArea.insertMany(uniqueAreas);
    console.log(`Inserted ${uniqueAreas.length} areas`);

    console.log("\n✅ Location data seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding location data:", error);
    process.exit(1);
  }
}

seedLocations();
