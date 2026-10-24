exports.calculatePointsFromService = (service) => {
  let totalHours = 0;

  // 1️⃣ Actual worked time (best)
  if (service.timeEntries && service.timeEntries.length > 0) {
    totalHours = service.timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
  }

  // 🎯 Points mapping
  if (totalHours <= 2) return 20;
  if (totalHours <= 5) return 30;
  return 40;
};
