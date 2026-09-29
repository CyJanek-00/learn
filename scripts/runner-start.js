const { spawnSync } = require('child_process');
const {
  loadConfig,
  loadState,
  saveState,
  getNow,
  evaluateDay,
  calculateRandomStartTime,
  calculateEndTime,
  sleepUntil
} = require('./utils/schedule-helper');

async function main() {
  const args = process.argv.slice(2);
  const isImmediate = args.includes('--immediate') || process.env.IMMEDIATE === 'true';
  const isForce = args.includes('--force') || process.env.FORCE === 'true';
  const isDryRun = args.includes('--dry-run') || process.env.DRY_RUN === 'true';

  console.log('='.repeat(60));
  console.log('  URUCHAMIANIE STARTU PRACY ZDALNEJ');
  console.log('='.repeat(60));

  const config = loadConfig();
  const now = getNow(config);
  const todayStr = now.toFormat('yyyy-MM-dd');

  console.log(`[INFO] Bieżący czas: ${now.toFormat('yyyy-MM-dd HH:mm:ss')} (${config.timeZone})`);
  console.log(`[INFO] Flagi: immediate=${isImmediate}, force=${isForce}, dry-run=${isDryRun}`);

  // 1. Sprawdzenie czy dzisiaj jest dzień pracy
  if (!isForce) {
    const dayEval = evaluateDay(now, config);
    if (!dayEval.shouldWork) {
      console.log(`[POMINIĘTO] ${dayEval.reason}. Nie uruchamiam startu.`);
      process.exit(0);
    }
    console.log(`[OK] ${dayEval.reason}`);

    // Sprawdzenie czy start nie był już wykonany dzisiaj
    const currentState = loadState();
    if (currentState && currentState.date === todayStr && (currentState.status === 'STARTED' || currentState.status === 'ENDED')) {
      console.log(`[POMINIĘTO] Praca na dzisiaj (${todayStr}) została już zainicjalizowana o ${currentState.startedAt}. Status: ${currentState.status}.`);
      process.exit(0);
    }
  } else {
    console.log('[INFO] Pominięto weryfikację dnia pracy z uwagi na flagę --force.');
  }

  // 2. Ustalenie godziny startu
  let plannedStartDt;
  if (isImmediate) {
    plannedStartDt = now;
    console.log('[INFO] Tryb natychmiastowy - start bez oczekiwania.');
  } else {
    plannedStartDt = calculateRandomStartTime(now, config);
    console.log(`[PLAN] Losowy czas rozpoczęcia w przedziale ${config.startWindow.earliest} - ${config.startWindow.latest}: ${plannedStartDt.toFormat('HH:mm:ss')}`);
  }

  // 3. Wstępne wyliczenie czasu zakończenia
  const previewEnd = calculateEndTime(plannedStartDt, config);
  const hours = Math.floor(previewEnd.durationMinutes / 60);
  const mins = previewEnd.durationMinutes % 60;
  console.log(`[PLAN] Szacowane zakończenie: ${previewEnd.endDt.toFormat('HH:mm:ss')} (czas pracy: ${hours}h ${mins}m)`);

  if (isDryRun) {
    console.log('[DRY-RUN] Test zakończony pomyślnie. Nie uruchomiono Cypress ani nie zapisano stanu.');
    process.exit(0);
  }

  // 4. Oczekiwanie na zaplanowaną godzinę
  if (!isImmediate && plannedStartDt > now) {
    await sleepUntil(plannedStartDt, 'Start pracy');
  }

  // 5. Uruchomienie testu Cypress
  console.log('\n[CYPRESS] Uruchamianie testu Cypress: npm run start ...');
  const cypressResult = spawnSync('npm', ['run', 'start'], {
    stdio: 'inherit',
    shell: true,
    env: process.env
  });

  if (cypressResult.status !== 0) {
    console.error(`\n[BŁĄD] Test Cypress zakończył się niepowodzeniem (kod: ${cypressResult.status})`);
    process.exit(cypressResult.status || 1);
  }

  // 6. Zapis stanu po pomyślnym wykonaniu testu
  const actualStart = getNow(config);
  const actualEndCalc = calculateEndTime(actualStart, config);

  const stateToSave = {
    date: todayStr,
    status: 'STARTED',
    startedAt: actualStart.toISO(),
    plannedEndTime: actualEndCalc.endDt.toISO(),
    plannedDurationMinutes: actualEndCalc.durationMinutes,
    endedAt: null,
    actualDurationMinutes: null
  };

  saveState(stateToSave);

  const finalHours = Math.floor(actualEndCalc.durationMinutes / 60);
  const finalMins = actualEndCalc.durationMinutes % 60;
  console.log('\n' + '='.repeat(60));
  console.log(`[SUKCES] Rozpoczęto pracę zdalną o: ${actualStart.toFormat('HH:mm:ss')}`);
  console.log(`[INFO] Zaplanowane zakończenie pracy: ${actualEndCalc.endDt.toFormat('HH:mm:ss')} (~${finalHours}h ${finalMins}m)`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('[KRYTYCZNY BŁĄD]', err);
  process.exit(1);
});
