const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');
const { checkPolishHoliday } = require('./holidays');

const CONFIG_PATH = path.resolve(__dirname, '../../config/schedule.json');
const STATE_PATH = path.resolve(__dirname, '../../state/work-state.json');

/**
 * Loads schedule config
 */
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Configuration file not found at ${CONFIG_PATH}`);
  }
  const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
  return JSON.parse(content);
}

/**
 * Loads or initializes state
 */
function loadState() {
  if (!fs.existsSync(STATE_PATH)) {
    return null;
  }
  try {
    const content = fs.readFileSync(STATE_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.warn(`[WARN] Failed to parse state file, initializing fresh state: ${err.message}`);
    return null;
  }
}

/**
 * Saves state to file
 */
function saveState(state) {
  const dir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Returns current DateTime in configured timezone
 */
function getNow(config) {
  const zone = (config && config.timeZone) || 'Europe/Warsaw';
  return DateTime.now().setZone(zone);
}

/**
 * Checks if a specific day is a work day based on config
 * @param {DateTime} dt
 * @param {object} config
 * @returns {{ shouldWork: boolean, reason: string }}
 */
function evaluateDay(dt, config) {
  const dateStr = dt.toFormat('yyyy-MM-dd');

  // 1. Explicit custom work days override any off-day rules
  if (config.customWorkDays && config.customWorkDays.includes(dateStr)) {
    return { shouldWork: true, reason: `Dzień dodany ręcznie do customWorkDays (${dateStr})` };
  }

  // 2. Custom holiday / vacation days
  if (config.customHolidays && config.customHolidays.includes(dateStr)) {
    return { shouldWork: false, reason: `Dzień wolny w customHolidays (${dateStr})` };
  }

  // 3. Polish statutory holidays
  if (config.skipPolishHolidays) {
    const holidayCheck = checkPolishHoliday(dt);
    if (holidayCheck.isHoliday) {
      return { shouldWork: false, reason: `Święto ustawowo wolne od pracy: ${holidayCheck.name}` };
    }
  }

  // 4. Allowed weekdays (1 = Monday ... 7 = Sunday)
  const weekday = dt.weekday;
  const dayNames = ['', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
  if (!config.workDays || !config.workDays.includes(weekday)) {
    return { shouldWork: false, reason: `Dzień tygodnia (${dayNames[weekday]}) poza dozwolonymi dniami pracy (${config.workDays})` };
  }

  return { shouldWork: true, reason: `Dzień roboczy (${dayNames[weekday]})` };
}

/**
 * Parses "HH:mm" time string into DateTime on the same day
 */
function parseTime(timeStr, baseDt) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return baseDt.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
}

/**
 * Returns a random integer between min and max (inclusive)
 */
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calculates a random start time within startWindow
 */
function calculateRandomStartTime(baseDt, config) {
  const earliest = parseTime(config.startWindow.earliest, baseDt);
  const latest = parseTime(config.startWindow.latest, baseDt);

  const minMillis = earliest.toMillis();
  const maxMillis = latest.toMillis();

  if (minMillis >= maxMillis) {
    return earliest;
  }

  const randomMillis = getRandomInt(minMillis, maxMillis);
  return DateTime.fromMillis(randomMillis, { zone: baseDt.zoneName });
}

/**
 * Calculates planned work duration and target end time
 */
function calculateEndTime(startDt, config) {
  const baseMinutes = (config.workDuration.targetHours || 8) * 60;
  const variance = config.workDuration.varianceMinutes || 15;
  const randomDeltaMinutes = getRandomInt(-variance, variance);

  const durationMinutes = baseMinutes + randomDeltaMinutes;
  let endDt = startDt.plus({ minutes: durationMinutes });

  // Clamp within endWindow if configured
  if (config.endWindow) {
    const earliestEnd = parseTime(config.endWindow.earliest, startDt);
    const latestEnd = parseTime(config.endWindow.latest, startDt);

    if (endDt < earliestEnd) {
      endDt = earliestEnd;
    } else if (endDt > latestEnd) {
      endDt = latestEnd;
    }
  }

  const finalDurationMinutes = Math.round(endDt.diff(startDt, 'minutes').minutes);

  return {
    endDt,
    durationMinutes: finalDurationMinutes
  };
}

/**
 * Sleeps with periodic heartbeat logging
 */
async function sleepUntil(targetDt, label = 'Akcja') {
  const now = DateTime.now().setZone(targetDt.zoneName);
  let remainingMs = targetDt.toMillis() - now.toMillis();

  if (remainingMs <= 0) {
    console.log(`[${now.toFormat('HH:mm:ss')}] Czas docelowy (${targetDt.toFormat('HH:mm:ss')}) już nadszedł. Uruchamianie natychmiast.`);
    return;
  }

  const remainingMin = Math.round(remainingMs / 60000);
  console.log(`[${now.toFormat('HH:mm:ss')}] ${label}: zaplanowano na ${targetDt.toFormat('HH:mm:ss')}. Pozostało oczekiwania: ~${remainingMin} minut.`);

  const heartbeatIntervalMs = 5 * 60 * 1000; // 5 minut

  while (remainingMs > 0) {
    const sleepChunkMs = Math.min(remainingMs, heartbeatIntervalMs);
    await new Promise(resolve => setTimeout(resolve, sleepChunkMs));

    const currentNow = DateTime.now().setZone(targetDt.zoneName);
    remainingMs = targetDt.toMillis() - currentNow.toMillis();

    if (remainingMs > 0) {
      const minsLeft = Math.round(remainingMs / 60000);
      console.log(`[${currentNow.toFormat('HH:mm:ss')}] ${label}: nadal oczekuję... Pozostało: ~${minsLeft} min (cel: ${targetDt.toFormat('HH:mm:ss')}).`);
    }
  }

  const finalNow = DateTime.now().setZone(targetDt.zoneName);
  console.log(`[${finalNow.toFormat('HH:mm:ss')}] ${label}: czas docelowy osiągnięty!`);
}

module.exports = {
  loadConfig,
  loadState,
  saveState,
  getNow,
  evaluateDay,
  calculateRandomStartTime,
  calculateEndTime,
  sleepUntil
};
