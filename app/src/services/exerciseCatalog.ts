export type Exercise = {
  id: string;
  name: string;
  muscleGroup: string;
  referenceModelUri?: string;
};

export const EXERCISES: Exercise[] = [
  { id: 'squat', name: 'Agachamento', muscleGroup: 'Pernas' },
  { id: 'pushup', name: 'Flexão de braço', muscleGroup: 'Peito/Tríceps' },
  { id: 'deadlift', name: 'Levantamento terra', muscleGroup: 'Posterior/Costas' },
  { id: 'shoulder_press', name: 'Desenvolvimento de ombro', muscleGroup: 'Ombros' },
];
