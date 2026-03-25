export enum WorkoutType {
  KRAFTTRAINING = 0,
  CARDIO = 1,
  PLYOMETRICS = 2,
  SPIEL_SIMULATION = 3,
  TECHNISCHE_DRILLS = 4,
  WETTKAMPF = 5,
  AUFWAERMEN = 6,
  MOBILITY = 7,
  DEHNEN = 8,
  REGENERATION = 9,
  PREHAB = 10
}

const WORKOUT_LABELS_BY_INDEX: Record<number, string> = {
  0: 'Kraft',
  1: 'Cardio',
  2: 'Plyo',
  3: 'Spiel',
  4: 'Drills',
  5: 'Wettkampf',
  6: 'Warm-up',
  7: 'Mobility',
  8: 'Dehnen',
  9: 'Regeneration',
  10: 'Prehab',
};

const WORKOUT_LABELS_BY_NAME: Record<string, string> = {
  KRAFTTRAINING: 'Kraft',
  CARDIO: 'Cardio',
  PLYOMETRICS: 'Plyo',
  SPIEL_SIMULATION: 'Spiel',
  TECHNISCHE_DRILLS: 'Drills',
  WETTKAMPF: 'Wettkampf',
  AUFWAERMEN: 'Warm-up',
  MOBILITY: 'Mobility',
  DEHNEN: 'Dehnen',
  REGENERATION: 'Regeneration',
  PREHAB: 'Prehab',
};

export function getWorkoutTypeLabel(type: string | number): string {
  const asNumber = Number(type);
  if (!Number.isNaN(asNumber) && asNumber in WORKOUT_LABELS_BY_INDEX) {
    return WORKOUT_LABELS_BY_INDEX[asNumber]!;
  }
  return WORKOUT_LABELS_BY_NAME[String(type)] ?? String(type);
}

function toWorkoutTypeArray(input: unknown): unknown[] {
  if (Array.isArray(input)) {
    return input;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return trimmed.split(',').map((value) => value.trim());
    }
  }

  return [];
}

export function normalizeWorkoutTypes(input: unknown): WorkoutType[] {
  const validTypes = new Set<number>(
    Object.values(WorkoutType).filter((value): value is number => typeof value === 'number')
  );

  const normalized = toWorkoutTypeArray(input)
    .map((value) => (typeof value === 'number' ? value : Number(value)))
    .filter((value) => Number.isInteger(value) && validTypes.has(value));

  return Array.from(new Set(normalized)) as WorkoutType[];
}