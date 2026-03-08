import React, { createContext, useContext, useState } from 'react';
import { WorkoutType } from './workoutType';

interface WorkoutTypeContextType {
  selectedWorkoutTypes: WorkoutType[];
  setSelectedWorkoutTypes: (types: WorkoutType[]) => void;
}

const WorkoutTypeContext = createContext<WorkoutTypeContextType | undefined>(undefined);

export function WorkoutTypeProvider({ children }: { children: React.ReactNode }) {
  const [selectedWorkoutTypes, setSelectedWorkoutTypes] = useState<WorkoutType[]>([
    WorkoutType.KRAFTTRAINING
  ]);

  return (
    <WorkoutTypeContext.Provider value={{ selectedWorkoutTypes, setSelectedWorkoutTypes }}>
      {children}
    </WorkoutTypeContext.Provider>
  );
}

export function useWorkoutTypeContext() {
  const context = useContext(WorkoutTypeContext);
  if (!context) {
    throw new Error('useWorkoutTypeContext must be used within a WorkoutTypeProvider');
  }
  return context;
}
