exports.calculatePointsFromService = (service) => {
  let totalHours = 0;

  // 1️⃣ Actual worked time (best)
  if (service.timeEntries && service.timeEntries.length > 0) {
    totalHours = service.timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
  }
  // 2️⃣ Fallback: duration
  else if (service.duration?.value) {
    const { value, unit } = service.duration;

    if (unit === 'minutes') totalHours = value / 60;
    if (unit === 'hours') totalHours = value;
    if (unit === 'days') totalHours = value * 8; // 1 day = 8h
  }

  // 🎯 Points mapping
  if (totalHours <= 2) return 20;
  if (totalHours <= 5) return 30;
  return 40;
};
