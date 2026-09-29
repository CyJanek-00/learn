# Automatyzacja rejestracji czasu pracy zdalnej (Cypress + GitHub Actions)

Projekt służy do symulacji i rejestrowania rozpoczęcia oraz zakończenia czasu pracy zdalnej z losowym rozkładem godzin oraz uwzględnieniem dni wolnych od pracy.

---

## 🎯 Główne funkcjonalności

1. **Losowe godziny rozpoczęcia i zakończenia (~8h pracy)**:
   - Start losowany w zadanym oknie czasowym (domyślnie **06:45 – 08:45**, możliwość zmiany np. **06:00 – 09:00**).
   - Zakończenie pracy wyliczane dynamicznie na podstawie rzeczywistego czasu startu: **8 godzin +/- 15 minut** w oknie **15:00 – 17:00**.
   - Stan sesji (`state/work-state.json`) jest synchronizowany między poranną a popołudniową akcją przez repozytorium GitHub.

2. **Obsługa świąt i dni wolnych**:
   - **Polskie święta ustawowo wolne od pracy** (Nowy Rok, Trzech Króli, Wielkanoc, Boże Ciało, Święto Pracy, 3 Maja, 11 Listopada itd.) są automatycznie wykrywane i pomijane.
   - Algorytm dynamicznie wylicza święta ruchome (Wielkanoc, Poniedziałek Wielkanocny, Boże Ciało) dla każdego roku.
   - Możliwość zdefiniowania własnych dni wolnych (np. urlop, 24 grudnia Wigilia, 31 grudnia Sylwester).
   - Możliwość wyboru dni roboczych (np. poniedziałek–piątek lub 4-dniowy tydzień pracy).

3. **Odporność na przesunięcia czasowe**:
   - Praca w strefie czasowej `Europe/Warsaw` z automatyczną obsługą czasu letniego (CEST) i zimowego (CET).
   - GitHub Actions uruchamia runnera przed oknem czasowym, po czym skrypt bezpiecznie odlicza do wylosowanej minuty.
   - Jeśli runner uruchomi się z opóźnieniem GitHub Actions, skrypt natychmiast rozpoczyna pracę bez zbędnego czekania.

---

## ⚙️ Konfiguracja (`config/schedule.json`)

Wszystkie parametry harmonogramu znajdują się w pliku [`config/schedule.json`](./config/schedule.json):

```json
{
  "timeZone": "Europe/Warsaw",
  "workDays": [1, 2, 3, 4, 5],
  "skipPolishHolidays": true,
  "customHolidays": [
    "2026-12-24",
    "2026-12-31"
  ],
  "customWorkDays": [],
  "startWindow": {
    "earliest": "06:45",
    "latest": "08:45"
  },
  "workDuration": {
    "targetHours": 8,
    "varianceMinutes": 15
  },
  "endWindow": {
    "earliest": "15:00",
    "latest": "17:00"
  }
}
```

### Wyjaśnienie pól:

| Pole | Typ | Opis |
| --- | --- | --- |
| `timeZone` | string | Strefa czasowa (domyślnie `"Europe/Warsaw"`). |
| `workDays` | array | Numery dni tygodnia wg ISO: `1` = Poniedziałek, `2` = Wtorek, `3` = Środa, `4` = Czwartek, `5` = Piątek, `6` = Sobota, `7` = Niedziela. |
| `skipPolishHolidays` | boolean | Czy automatycznie pomijać wszystkie polskie święta ustawowo wolne od pracy (`true` / `false`). |
| `customHolidays` | array | Lista dodatkowych dni wolnych w formacie `["YYYY-MM-DD"]` (np. urlopy, Wigilia). |
| `customWorkDays` | array | Lista dodatkowych dni pracujących w formacie `["YYYY-MM-DD"]` (np. odpracowanie w sobotę). |
| `startWindow.earliest` | string | Najwcześniejsza dopuszczalna godzina startu (`"06:45"`). |
| `startWindow.latest` | string | Najpóźniejsza dopuszczalna godzina startu (`"08:45"`). |
| `workDuration.targetHours` | number | Bazowy wymiar czasu pracy w godzinach (np. `8`). |
| `workDuration.varianceMinutes` | number | Maksymalna losowa różnica w minutach (np. `15` oznacza od 7h 45m do 8h 15m). |
| `endWindow.earliest` | string | Najwcześniejsza godzina zakończenia pracy (`"15:00"`). |
| `endWindow.latest` | string | Najpóźniejsza godzina zakończenia pracy (`"17:00"`). |

---

## 🛠️ Polecenia lokalne

Możesz w każdej chwili przetestować działanie harmonogramu i skryptów w terminalu:

### 1. Podgląd harmonogramu i symulacja na 7 dni
```bash
npm run schedule:check
```
Wyświetli aktualny status, weryfikację dzisiejszego dnia, tabelę symulacji losowych godzin na najbliższy tydzień oraz wykaz świąt państwowych.

### 2. Testowy start (tryb dry-run – bez Cypress)
```bash
node scripts/runner-start.js --dry-run
```

### 3. Testowe zakończenie (tryb dry-run)
```bash
node scripts/runner-end.js --dry-run --force
```

### 4. Ręczne uruchomienie testów Cypress
- Rozpoczęcie: `npm run start`
- Zakończenie: `npm run end`

---

## 🚀 GitHub Actions

W repozytorium skonfigurowane są dwa workflow:
- [`.github/workflows/start.yml`](./.github/workflows/start.yml) – uruchamiany codziennie od poniedziałku do piątku rano.
- [`.github/workflows/end.yml`](./.github/workflows/end.yml) – uruchamiany codziennie od poniedziałku do piątku po południu.

### Uruchamianie ręczne (workflow_dispatch)
W zakładce Actions na GitHubie można w każdej chwili uruchomić akcję ręcznie z parametrami:
- **`immediate`** (domyślnie `true`) – wykonuje test Cypress od razu, bez czekania na wylosowaną godzinę.
- **`force`** (domyślnie `false`) – wymusza wykonanie nawet jeśli dziś wypada weekend, święto lub brak wpisu porannego.
- **`dry_run`** (domyślnie `false`) – uruchamia przepływ testowy bez klikania w Cypress.
