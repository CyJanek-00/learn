const { DateTime } = require('luxon');

/**
 * Calculates Easter Sunday for a given year using Meeus/Jones/Butcher algorithm
 * @param {number} year
 * @returns {DateTime}
 */
function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return DateTime.fromObject({ year, month, day }, { zone: 'Europe/Warsaw' });
}

/**
 * Returns all statutory non-working days in Poland for a given year
 * @param {number} year
 * @returns {Array<{ date: string, name: string }>}
 */
function getPolishHolidays(year) {
  const easter = getEasterSunday(year);
  const easterMonday = easter.plus({ days: 1 });
  const pentecost = easter.plus({ days: 49 });
  const corpusChristi = easter.plus({ days: 60 });

  return [
    { date: `${year}-01-01`, name: 'Nowy Rok' },
    { date: `${year}-01-06`, name: 'Święto Trzech Króli' },
    { date: easter.toFormat('yyyy-MM-dd'), name: 'Niedziela Wielkanocna' },
    { date: easterMonday.toFormat('yyyy-MM-dd'), name: 'Poniedziałek Wielkanocny' },
    { date: `${year}-05-01`, name: 'Święto Państwowe (Święto Pracy)' },
    { date: `${year}-05-03`, name: 'Święto Narodowe Trzeciego Maja' },
    { date: pentecost.toFormat('yyyy-MM-dd'), name: 'Zielone Świątki' },
    { date: corpusChristi.toFormat('yyyy-MM-dd'), name: 'Boże Ciało' },
    { date: `${year}-08-15`, name: 'Wniebowzięcie NMP / Święto Wojska Polskiego' },
    { date: `${year}-11-01`, name: 'Wszystkich Świętych' },
    { date: `${year}-11-11`, name: 'Narodowe Święto Niepodległości' },
    { date: `${year}-12-25`, name: 'Boże Narodzenie (pierwszy dzień)' },
    { date: `${year}-12-26`, name: 'Boże Narodzenie (drugi dzień)' }
  ];
}

/**
 * Checks if a given DateTime falls on a Polish statutory holiday
 * @param {DateTime} dt
 * @returns {{ isHoliday: boolean, name?: string }}
 */
function checkPolishHoliday(dt) {
  const dateStr = dt.toFormat('yyyy-MM-dd');
  const holidays = getPolishHolidays(dt.year);
  const holiday = holidays.find(h => h.date === dateStr);
  if (holiday) {
    return { isHoliday: true, name: holiday.name };
  }
  return { isHoliday: false };
}

module.exports = {
  getEasterSunday,
  getPolishHolidays,
  checkPolishHoliday
};
