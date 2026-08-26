export interface ExperienceDuration {
  years: number;
  months: number;
}

function parseLocalDate(value: string): Date {
  const [year, month, day = 1] = value.split("-").map(Number);

  if (!year || !month || month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`Invalid career start date: ${value}`);
  }

  return new Date(year, month - 1, day);
}

export function getExperienceDuration(
  startDate: string,
  endDate = new Date(),
): ExperienceDuration {
  const start = parseLocalDate(startDate);
  let totalMonths =
    (endDate.getFullYear() - start.getFullYear()) * 12 +
    endDate.getMonth() -
    start.getMonth();

  if (endDate.getDate() < start.getDate()) {
    totalMonths -= 1;
  }

  if (totalMonths < 0) {
    throw new Error("Career start date cannot be in the future");
  }

  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
  };
}

export function formatExperienceCompact(duration: ExperienceDuration): string {
  return `${duration.years}y ${duration.months}m`;
}

export function formatExperienceLong(duration: ExperienceDuration): string {
  const years = `${duration.years} ${duration.years === 1 ? "year" : "years"}`;
  const months = `${duration.months} ${duration.months === 1 ? "month" : "months"}`;

  return `${years} ${months}`;
}
