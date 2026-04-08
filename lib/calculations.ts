export interface SubjectiveData {
  mood: number;
  recovery: number;
  health: number;
  physical: number;
  sleep: number;
  stress: number;
  soreness: number;
  isSick: boolean;
  isInjured: boolean;
}

export interface ObjectiveData {
  hrv: number | null;
  sleepHours: number | null;
  restingHr: number | null;
  baselineHrv: number;
  baselineRhr: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function tenPointScore(value: number): number {
  return clamp(value, 1, 10) * 10;
}

function inverseTenPointScore(value: number): number {
  return (11 - clamp(value, 1, 10)) * 10;
}

function calculateSubjectiveScore(subjective: SubjectiveData): number {
  const weightedScore = (
    tenPointScore(subjective.mood) * 0.08 +
    tenPointScore(subjective.recovery) * 0.2 +
    tenPointScore(subjective.health) * 0.18 +
    tenPointScore(subjective.physical) * 0.17 +
    tenPointScore(subjective.sleep) * 0.15 +
    inverseTenPointScore(subjective.stress) * 0.1 +
    inverseTenPointScore(subjective.soreness) * 0.12
  );

  return clamp(12 + (weightedScore * 0.88), 0, 95);
}

function calculateObjectiveModifier(objective: ObjectiveData | undefined): number {
  if (!objective) {
    return 0;
  }

  let modifier = 0;

  if (typeof objective.sleepHours === 'number' && objective.sleepHours > 0) {
    const sleepDelta = clamp((objective.sleepHours - 7.5) / 2, -1, 1);
    modifier += sleepDelta * 2.5;
  }

  if (typeof objective.hrv === 'number' && objective.hrv > 0 && objective.baselineHrv > 0) {
    const hrvDelta = clamp(((objective.hrv - objective.baselineHrv) / objective.baselineHrv) / 0.12, -1, 1);
    modifier += hrvDelta * 4;
  }

  if (typeof objective.restingHr === 'number' && objective.restingHr > 0 && objective.baselineRhr > 0) {
    const rhrDelta = clamp(((objective.baselineRhr - objective.restingHr) / objective.baselineRhr) / 0.08, -1, 1);
    modifier += rhrDelta * 3;
  }

  return clamp(modifier, -8, 8);
}

function calculateLoadPenalty(
  currentDayLoad: number,
  pastSixDaysLoad: number,
  pastThirteenDaysLoad: number
): number {
  const previousDailyAverage = pastSixDaysLoad > 0
    ? pastSixDaysLoad / 6
    : pastThirteenDaysLoad > 0
      ? pastThirteenDaysLoad / 13
      : 0;

  const protectedBaseline = Math.max(previousDailyAverage, currentDayLoad > 0 ? 75 : 0);
  let penalty = 0;
  let dailySpikeRatio = 1;

  if (currentDayLoad > 0 && protectedBaseline > 0) {
    dailySpikeRatio = currentDayLoad / protectedBaseline;
    if (dailySpikeRatio > 1.2) {
      penalty += Math.min((dailySpikeRatio - 1.2) * 6.5, 8);
    }
  }

  const acuteAverage = (pastSixDaysLoad + currentDayLoad) / 7;
  const chronicAverage = pastThirteenDaysLoad > 0 ? pastThirteenDaysLoad / 13 : acuteAverage;
  const loadRampRatio = chronicAverage > 0 ? acuteAverage / chronicAverage : 1;

  if (loadRampRatio > 1.08) {
    penalty += Math.min((loadRampRatio - 1.08) * 12, 5);
  }

  if (currentDayLoad >= 350 && currentDayLoad > acuteAverage * 1.5) {
    penalty += 3;
  }

  if (currentDayLoad >= 700 && dailySpikeRatio > 2) {
    penalty += 2;
  }

  return clamp(penalty, 0, 16);
}

export function calculateReadiness(
  subjective: SubjectiveData,
  objective: ObjectiveData | undefined,
  currentDayLoad: number,
  pastSixDaysLoad: number,
  pastThirteenDaysLoad: number
) {
  if (subjective.isSick) {
    return 8;
  }

  const subjectiveScore = calculateSubjectiveScore(subjective);
  const objectiveModifier = calculateObjectiveModifier(objective);
  const loadPenalty = calculateLoadPenalty(currentDayLoad, pastSixDaysLoad, pastThirteenDaysLoad);

  let finalScore = subjectiveScore + objectiveModifier - loadPenalty;

  if (subjective.isInjured) {
    finalScore = Math.min(finalScore - 12, 55);
  }

  if (subjective.health <= 2) {
    finalScore = Math.min(finalScore, 30);
  }

  return clamp(Math.round(finalScore), 0, 100);
}