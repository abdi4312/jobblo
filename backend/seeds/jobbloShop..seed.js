const JobbloShop = require("../models/JobbloShop");

module.exports = async () => {
  await JobbloShop.deleteMany();
  const rewards = [
    {
      title: "10% Rabatt på neste bestilling",
      description: "Få 10% rabatt på din neste tjeneste",
      coins: 500,
      category: "Rabatt",
    },
    {
      title: "20% Rabatt på neste bestilling",
      description: "Få 20% rabatt på din neste tjeneste",
      coins: 1000,
      category: "Rabatt",
    },
    {
      title: "Gratis Premium i 1 måned",
      description: "Få tilgang til premium funksjoner i 30 dager",
      coins: 2000,
      category: "Premium",
    },
    {
      title: "50% Rabatt på Premium",
      description: "Få 50% rabatt på din neste Premium abonnement",
      coins: 1500,
      category: "Premium",
    },
    {
      title: "Gratis annonse-fremheving",
      description: "Fremhev din annonse i 7 dager",
      coins: 800,
      category: "Synlighet",
    },
    {
      title: "Prioritert kundestøtte",
      description: "Få prioritert hjelp fra vårt supportteam",
      coins: 300,
      category: "Service",
    },
  ];
  await JobbloShop.insertMany(rewards);
  console.log(`JobbloShop seeded ${rewards.length} rewards`);
};
