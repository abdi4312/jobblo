# Jobblo Database Seeders

This folder contains seed scripts to populate the local development database
with realistic demo data for Jobblo.

⚠️ **Seeders are intended for LOCAL DEVELOPMENT ONLY**

---

## 1️⃣ Prerequisites

- Node.js installed
- MongoDB running locally
- `.env` file configured with:

```env
MONGO_URI=mongodb://localhost:27017/jobblo_dev

2️⃣ Run ALL seeders (recommended first run)

This will clear and re-create all data in the correct order: (all of your exisiting data will be deleted)

node seeds/index.js

This seeds:

Users
Categories
Services
Orders
Reviews
Notifications

3️⃣ Run individual seeders

For Conversations:
node seeds/run-conversations.js

For Favourties:
node seeds/run-favorites.js

For Filters:
node seeds/run-filters.js

For Plans:
node seeds/run-plan.js

5️⃣ Notes

Running a seeder will overwrite data in its collection
Seed data is in Norwegian (demo content)
Images use placeholder/CDN URLs
Designed to support frontend UI development