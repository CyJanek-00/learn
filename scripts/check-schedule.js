const { DateTime } = require('luxon');
const {
  loadConfig,
  loadState,
  getNow,
  evaluateDay,
  calculateRandomStartTime,
  calculateEndTime
} = require('./utils/schedule-helper');
const { getPolishHolidays } = require('./utils/holidays');

function checkSchedule() {
  const config = loadConfig();
  const now = getNow(config);

  console.log('='.repeat(70));
  console.log('  STATUS HARMONOGRAMU I SYMULACJA CZASU PRACY');
  console.log('='.repeat(70));

  console.log('\n[KONFIGURACJA]');
  console.log(`- Strefa czasowa: ${config.timeZone}`);
  console.log(`- Dni pracy (1=Pon, 5=Pt): [${config.workDays.join(', ')}]`);
  console.log(`- Uwzględniaj polskie święta: ${config.skipPolishHolidays ? 'TAK' : 'NIE'}`);
  console.log(`- Okno startu: ${config.startWindow.earliest} - ${config.startWindow.latest}`);
  console.log(`- Bazowy czas pracy: ${config.workDuration.targetHours}h (wariacja +/- ${config.workDuration.varianceMinutes} min)`);
  console.log(`- Okno zakończenia: ${config.endWindow.earliest} - ${config.endWindow.latest}`);
  console.log(`- Niestandardowe dni wolne (customHolidays): ${config.customHolidays.length ? config.customHolidays.join(', ') : 'brak'}`);
  console.log(`- Dodatkowe dni pracujące (customWorkDays): ${config.customWorkDays.length ? config.customWorkDays.join(', ') : 'brak'}`);

  console.log('\n[DZISIEJSZY STATUS]');
  const todayEval = evaluateDay(now, config);
  console.log(`- Data: ${now.toFormat('yyyy-MM-dd')} (${now.toFormat('cccc')})`);
  console.log(`- Czy dzisiaj jest praca? ${todayEval.shouldWork ? 'TAK' : 'NIE'}`);
  console.log(`- Powód: ${todayEval.reason}`);

  const state = loadState();
  if (state && state.date === now.toFormat('yyyy-MM-dd')) {
    console.log(`- Zapisany stan dzisiaj:`);
    console.log(`  * Status: ${state.status}`);
    console.log(`  * Rozpoczęto o: ${state.startedAt || '-'}`);
    console.log(`  * Zaplanowano koniec na: ${state.plannedEndTime || '-'}`);
    console.log(`  * Zakończono o: ${state.endedAt || '-'}`);
  } else {
    console.log('- Brak zapisanego stanu dla dnia dzisiejszego.');
  }

  console.log('\n[SYMULACJA DLA NAJBLIŻSZYCH 7 DNI]');
  const simulationRows = [];

  for (let i = 0; i < 7; i++) {
    const day = now.plus({ days: i });
    const dayEval = evaluateDay(day, config);
    const dayName = day.setLocale('pl').toFormat('cccc');
    const dateFormatted = day.toFormat('yyyy-MM-dd');

    if (!dayEval.shouldWork) {
      simulationRows.push({
        Data: `${dateFormatted} (${dayName})`,
        Status: 'WOLNE',
        Start: '-',
        Koniec: '-',
        Czas: '-',
        Uwagi: dayEval.reason
      });
    } else {
      const sampleStart = calculateRandomStartTime(day, config);
      const sampleEnd = calculateEndTime(sampleStart, config);
      const hours = Math.floor(sampleEnd.durationMinutes / 60);
      const mins = sampleEnd.durationMinutes % 60;

      simulationRows.push({
        Data: `${dateFormatted} (${dayName})`,
        Status: 'PRACA',
        Start: sampleStart.toFormat('HH:mm'),
        Koniec: sampleEnd.endDt.toFormat('HH:mm'),
        Czas: `${hours}h ${mins}m`,
        Uwagi: dayEval.reason
      });
    }
  }

  console.table(simulationRows);

  console.log('\n[ŚWIĘTA USTAWOWO WOLNE OD PRACY W POLSCE DLA ' + now.year + ']');
  const holidays = getPolishHolidays(now.year);
  console.table(holidays);
}

checkSchedule();
