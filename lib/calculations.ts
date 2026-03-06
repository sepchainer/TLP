export interface SubjectiveData {
  mood: number;
  recovery: number;
  health: number;
  physical: number;
  sleep: number;
  stress: number;
  isSick: boolean;
}

export interface ObjectiveData {
  hrv: number | null;
  sleepHours: number | null;
  restingHr: number | null;
  baselineHrv: number;
  baselineRhr: number;
}

export function calculateReadiness(
  subjective: SubjectiveData,
  objective: ObjectiveData | undefined,
  currentDayLoad: number,
  pastSixDaysLoad: number,
  pastThirteenDaysLoad: number
) {
  // 1. HARD CONSTRAINT: Krankheit
  if (subjective.isSick) return 15;

  // 2. SUBJEKTIVER SCORE (Skala 1-10 -> 0-100)
  const invertedStress = 11 - subjective.stress;
  const subjectiveValues = [
    subjective.mood, subjective.recovery, subjective.health,
    subjective.physical, subjective.sleep, invertedStress
  ];
  const subAverage = subjectiveValues.reduce((a, b) => a + b, 0) / subjectiveValues.length;
  let baseScore = subAverage * 10;

  // 3. OBJEKTIVER SCORE (Vergleich mit individueller Baseline)
  let objectiveWeight = 0;
  let objectiveTotalScore = 0;
  let metricsCount = 0;

  if (objective) {
    // Schlaf Score (Ziel: 8h)
    if (objective.sleepHours && objective.sleepHours > 0) {
      objectiveTotalScore += Math.min((objective.sleepHours / 8) * 100, 100);
      objectiveWeight += 0.3;
      metricsCount++;
    }

    // HRV Score (Vergleich mit 30-Tage-Schnitt)
    if (objective.hrv && objective.hrv > 0) {
      const hrvRatio = objective.hrv / objective.baselineHrv;
      objectiveTotalScore += Math.min(hrvRatio * 100, 110);
      objectiveWeight += 0.2;
      metricsCount++;
    }

    // Ruhepuls Score (Abweichung von Baseline)
    if (objective.restingHr && objective.restingHr > 0) {
      // 100 Punkte wenn gleich Baseline, Abzug wenn Puls höher
      const rhrDiff = objective.restingHr - objective.baselineRhr;
      const rhrScore = Math.max(100 - (rhrDiff * 3), 0); 
      objectiveTotalScore += Math.min(rhrScore, 100);
      objectiveWeight += 0.1;
      metricsCount++;
    }
  }

  // Gewichtete Zusammenführung
  let finalScore = baseScore;
  if (metricsCount > 0) {
    const objAverage = objectiveTotalScore / metricsCount;
    finalScore = (baseScore * (1 - objectiveWeight)) + (objAverage * objectiveWeight);
  }

  // 4. ACWR LOGIK (Acute-Chronic Workload Ratio)
  const acuteLoad = (pastSixDaysLoad + currentDayLoad) / 7;
  const chronicLoad = (pastThirteenDaysLoad + currentDayLoad) / 14;

  const acwr = chronicLoad > 0 ? acuteLoad / chronicLoad : 1.0;

  // ACWR Penalty
  let loadModifier = 0;
  if (acwr > 1.3) {
    loadModifier = (acwr - 1.3) * 50; // -10 bei 1.5 ACWR
  } else if (acwr < 0.8) {
    loadModifier = (0.8 - acwr) * 10; // Kleiner Abzug bei De-Training
  }

  // 5. MONOTONIE / SPIKE ABZUG
  if (currentDayLoad > (acuteLoad * 2) && currentDayLoad > 300) {
    loadModifier += 10;
  }

  finalScore -= loadModifier;

  return Math.min(Math.max(Math.round(finalScore), 0), 100);
}