require("dotenv").config();
const mongoose = require("mongoose");
const seedPlans = require("./plan.seed");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("💳 Seeding plans only");

  await seedPlans();

  console.log("✅ Plans seeded");
  process.exit();
}

run();
