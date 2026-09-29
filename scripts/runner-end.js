const { spawnSync } = require('child_process');
const { DateTime } = require('luxon');
const {
  loadConfig,
  loadState,
  saveState,
  getNow,
  calculateRandomStartTime,
  sleepUntil
} = require('./utils/schedule-helper');

async function main() {
  const args = process.argv.slice(2);
  const isImmediate = args.includes('--immediate') || process.env.IMMEDIATE === 'true';
  const isForce = args.includes('--force') || process.env.FORCE === 'true';
  const isDryRun = args.includes('--dry-run') || process.env.DRY_RUN === 'true';

  console.log('='.repeat(60));
  console.log('  URUCHAMIANIE ZAKOŃCZENIA PRACY ZDALNEJ');
  console.log('='.repeat(60));

  const config = loadConfig();
  const now = getNow(config);
  const todayStr = now.toFormat('yyyy-MM-dd');

  console.log(`[INFO] Bieżący czas: ${now.toFormat('yyyy-MM-dd HH:mm:ss')} (${config.timeZone})`);
  console.log(`[INFO] Flagi: immediate=${isImmediate}, force=${isForce}, dry-run=${isDryRun}`);

  const currentState = loadState();

  // 1. Sprawdzenie stanu z poranka
  if (!isForce) {
    if (!currentState || currentState.date !== todayStr) {
      console.log(`[POMINIĘTO] Brak aktywnego startu pracy na dzisiaj (${todayStr}). Nic do zakończenia.`);
      process.exit(0);
    }

    if (currentState.status === 'ENDED') {
      console.log(`[POMINIĘTO] Praca na dzisiaj (${todayStr}) została już zakończona o ${currentState.endedAt}.`);
      process.exit(0);
    }
  } else {
    console.log('[INFO] Weryfikacja stanu pominięta z uwagi na flagę --force.');
  }

  // 2. Ustalenie godziny zakończenia
  let plannedEndDt;
  if (isImmediate) {
    plannedEndDt = now;
    console.log('[INFO] Tryb natychmiastowy - zakończenie bez oczekiwania.');
  } else if (currentState && currentState.plannedEndTime) {
    plannedEndDt = DateTime.fromISO(currentState.plannedEndTime).setZone(config.timeZone);
    console.log(`[PLAN] Odczytano zaplanowaną godzinę zakończenia: ${plannedEndDt.toFormat('HH:mm:ss')}`);
  } else {
    // Rezerwowo: losowa godzina z endWindow
    const fallbackWindow = {
      startWindow: {
        earliest: config.endWindow.earliest,
        latest: config.endWindow.latest
      }
    };
    plannedEndDt = calculateRandomStartTime(now, fallbackWindow);
    console.log(`[PLAN] Brak zapisanego plannedEndTime - wyznaczono godzinę z okna ${config.endWindow.earliest} - ${config.endWindow.latest}: ${plannedEndDt.toFormat('HH:mm:ss')}`);
  }

  if (isDryRun) {
    console.log('[DRY-RUN] Test zakończony pomyślnie. Nie uruchomiono Cypress ani nie zapisano stanu.');
    process.exit(0);
  }

  // 3. Oczekiwanie na zaplanowaną godzinę
  if (!isImmediate && plannedEndDt > now) {
    await sleepUntil(plannedEndDt, 'Zakończenie pracy');
  }

  // 4. Uruchomienie testu Cypress
  console.log('\n[CYPRESS] Uruchamianie testu Cypress: npm run end ...');
  const cypressResult = spawnSync('npm', ['run', 'end'], {
    stdio: 'inherit',
    shell: true,
    env: process.env
  });

  if (cypressResult.status !== 0) {
    console.error(`\n[BŁĄD] Test Cypress zakończył się niepowodzeniem (kod: ${cypressResult.status})`);
    process.exit(cypressResult.status || 1);
  }

  // 5. Zapis stanu po pomyślnym wykonaniu testu
  const actualEnd = getNow(config);
  let actualDurationMinutes = null;

  if (currentState && currentState.startedAt) {
    const startDt = DateTime.fromISO(currentState.startedAt).setZone(config.timeZone);
    actualDurationMinutes = Math.round(actualEnd.diff(startDt, 'minutes').minutes);
  }

  const updatedState = {
    ...(currentState || {}),
    date: todayStr,
    status: 'ENDED',
    endedAt: actualEnd.toISO(),
    actualDurationMinutes
  };

  saveState(updatedState);

  console.log('\n' + '='.repeat(60));
  console.log(`[SUKCES] Zakończono pracę zdalną o: ${actualEnd.toFormat('HH:mm:ss')}`);
  if (actualDurationMinutes !== null) {
    const durH = Math.floor(actualDurationMinutes / 60);
    const durM = actualDurationMinutes % 60;
    console.log(`[INFO] Całkowity czas pracy: ${durH}h ${durM}m`);
  }
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('[KRYTYCZNY BŁĄD]', err);
  process.exit(1);
});
