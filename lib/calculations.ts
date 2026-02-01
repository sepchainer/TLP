export function calculateReadiness(
  subjective: {
    mood: number; recovery: number; health: number;
    physical: number; sleep: number; stress: number;
    isSick: boolean;
  },
  objective?: {
    hrv: number | null;
    sleepHours: number | null;
    restingHr: number | null;
  },
  currentDayLoad: number = 0,
  sevenDayLoad: number = 0,   // Summe Last Tag -7 bis gestern
  fourteenDayLoad: number = 0 // Summe Last Tag -14 bis gestern
) {
  // 1. HARD CONSTRAINT: Krankheit
  if (subjective.isSick) return 15;

  // 2. SUBJEKTIVER SCORE (0-100)
  const invertedStress = 11 - subjective.stress;
  const subjectiveValues = [
    subjective.mood, subjective.recovery, subjective.health,
    subjective.physical, subjective.sleep, invertedStress
  ];
  const subAverage = subjectiveValues.reduce((a, b) => a + b, 0) / subjectiveValues.length;
  let baseScore = subAverage * 10;

  // 3. OBJEKTIVER SCORE (Fitbit)
  let objectiveWeight = 0;
  let objAverage = 0;

  if (objective) {
    let objectiveScores: number[] = [];
    // HRV Score: Wir nehmen 60ms als guten Standard-Referenzwert (ideal wäre später ein gleitender Schnitt)
    if (objective.hrv) objectiveScores.push(Math.min((objective.hrv / 60) * 100, 110));
    // Schlaf Score: 8h = 100%
    if (objective.sleepHours) objectiveScores.push(Math.min((objective.sleepHours / 8) * 100, 100));
    
    if (objectiveScores.length > 0) {
      objAverage = objectiveScores.reduce((a, b) => a + b, 0) / objectiveScores.length;
      objectiveWeight = 0.6; // Fitbit zählt 60%, wenn Daten vorhanden
    }
  }

  // Kombinierter Basis-Score
  let finalScore = objectiveWeight > 0 
    ? (baseScore * (1 - objectiveWeight)) + (objAverage * objectiveWeight)
    : baseScore;

  // 4. ACWR LOGIK (Acute-Chronic Workload Ratio)
  // Akute Last (letzte 7 Tage inkl. heute)
  const acuteLoad = (sevenDayLoad + currentDayLoad) / 7;
  // Chronische Last (letzte 14 Tage Durchschnitt)
  const chronicLoad = (fourteenDayLoad + currentDayLoad) / 14;

  // Verhältnis berechnen (vermeide Division durch Null)
  const acwr = chronicLoad > 0 ? acuteLoad / chronicLoad : 1.0;

  /**
   * ACWR Bewertung:
   * 0.8 - 1.3: "Sweet Spot" -> Readiness bleibt stabil oder steigt leicht
   * < 0.8: "Underloading" -> Readiness okay, aber Formverlust möglich
   * > 1.5: "Danger Zone" -> Hohes Verletzungsrisiko, Readiness sinkt stark
   */
  let loadModifier = 0;
  if (acwr > 1.3) {
    // Progressiver Abzug: Bei ACWR 1.5 ca. -10 Punkte, bei 2.0 ca. -25 Punkte
    loadModifier = (acwr - 1.3) * 30;
  } else if (acwr < 0.8) {
    // Leichter Abzug bei extremer Unterbelastung (Faulheit-Faktor)
    loadModifier = (0.8 - acwr) * 5;
  }

  // 5. ZUSÄTZLICHER MONOTONIE-ABZUG
  // Wenn die heutige Last extrem hoch ist (> 2x Tagesschnitt), ziehe extra ab
  if (currentDayLoad > (acuteLoad * 2) && currentDayLoad > 300) {
    loadModifier += 10;
  }

  finalScore -= loadModifier;

  return Math.min(Math.max(Math.round(finalScore), 0), 100);
}