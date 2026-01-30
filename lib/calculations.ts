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
  sevenDayLoad: number = 0 // Summe der Last der letzten 7 Tage (ohne heute)
) {
  if (subjective.isSick) return 20;

  // Basis-Berechnung (Subjektiv & Fitbit)
  const invertedStress = 11 - subjective.stress;
  const subjectiveValues = [
    subjective.mood, subjective.recovery, subjective.health,
    subjective.physical, subjective.sleep, invertedStress
  ];
  const subAverage = subjectiveValues.reduce((a, b) => a + b, 0) / subjectiveValues.length;
  let finalScore = subAverage * 10;

  if (objective && (objective.hrv || objective.sleepHours)) {
    let objectiveScores: number[] = [];
    if (objective.hrv) objectiveScores.push(Math.min((objective.hrv / 55) * 100, 110));
    if (objective.sleepHours) objectiveScores.push(Math.min((objective.sleepHours / 8) * 100, 100));
    
    if (objectiveScores.length > 0) {
      const objAverage = objectiveScores.reduce((a, b) => a + b, 0) / objectiveScores.length;
      finalScore = (finalScore * 0.4) + (objAverage * 0.6);
    }
  }

  // --- PROFI LOAD LOGIK ---
  
  // 1. Akute Ermüdung (Vortage): Ein Schnitt von > 500 Load pro Tag gilt als fordernd
  // Wir ziehen Punkte ab, wenn die 7-Tage-Last hoch ist (z.B. > 3500)
  const avgPastLoad = sevenDayLoad / 7;
  const fatigueFromPast = Math.min((avgPastLoad / 500) * 15, 20); 
  
  // 2. Heutige Erschöpfung (unmittelbar)
  const todayFatigue = (currentDayLoad / 1000) * 15;

  finalScore = finalScore - fatigueFromPast - todayFatigue;

  return Math.min(Math.max(Math.round(finalScore), 0), 100);
}