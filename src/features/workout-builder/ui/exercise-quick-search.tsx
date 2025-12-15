"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Search, Plus, X, Loader2 } from "lucide-react";
import { ExerciseAttributeValueEnum } from "@prisma/client";

import { useCurrentLocale, useI18n } from "locales/client";
import { cn } from "@/shared/lib/utils";

import { useWorkoutBuilderStore } from "../model/workout-builder.store";

interface ExerciseAttribute {
  id: string;
  attributeName: { name: string };
  attributeValue: { value: string };
}

interface Exercise {
  id: string;
  name: string;
  nameEn: string;
  fullVideoUrl: string | null;
  fullVideoImageUrl: string | null;
  attributes: ExerciseAttribute[];
}

interface ExerciseQuickSearchProps {
  onExerciseAdded?: () => void;
}

export function ExerciseQuickSearch({ onExerciseAdded }: ExerciseQuickSearchProps) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const [searchQuery, setSearchQuery] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);

  const { exercisesByMuscle, setExercisesByMuscle, setExercisesOrder, exercisesOrder, setStep } =
    useWorkoutBuilderStore();

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setExercises([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/exercises/all?search=${encodeURIComponent(searchQuery)}&limit=10`);
        if (response.ok) {
          const data = await response.json();
          setExercises(data.data || []);
        }
      } catch (error) {
        console.error("Error searching exercises:", error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const getMuscleFromExercise = (exercise: Exercise): ExerciseAttributeValueEnum => {
    const muscleAttr = exercise.attributes.find((attr) => attr.attributeName.name === "PRIMARY_MUSCLE");
    if (muscleAttr) {
      return muscleAttr.attributeValue.value as ExerciseAttributeValueEnum;
    }
    return "CHEST" as ExerciseAttributeValueEnum; // Default fallback
  };

  const handleAddExercise = useCallback(
    (exercise: Exercise) => {
      const muscle = getMuscleFromExercise(exercise);

      // Find existing muscle group or create new one
      const muscleGroupIndex = exercisesByMuscle.findIndex((group) => group.muscle === muscle);

      const exerciseData = {
        id: exercise.id,
        name: exercise.name,
        nameEn: exercise.nameEn,
        fullVideoImageUrl: exercise.fullVideoImageUrl,
        fullVideoUrl: exercise.fullVideoUrl,
        attributes: exercise.attributes,
      };

      if (muscleGroupIndex === -1) {
        // Create new muscle group
        const newExercisesByMuscle = [...exercisesByMuscle, { muscle, exercises: [exerciseData] }];
        setExercisesByMuscle(newExercisesByMuscle);
      } else {
        // Check if exercise already exists
        const existingExercises = exercisesByMuscle[muscleGroupIndex].exercises;
        const exerciseExists = existingExercises.some((ex: any) => ex.id === exercise.id);

        if (!exerciseExists) {
          const newExercisesByMuscle = [...exercisesByMuscle];
          newExercisesByMuscle[muscleGroupIndex] = {
            ...newExercisesByMuscle[muscleGroupIndex],
            exercises: [...newExercisesByMuscle[muscleGroupIndex].exercises, exerciseData],
          };
          setExercisesByMuscle(newExercisesByMuscle);
        }
      }

      // Add to order if not already present
      if (!exercisesOrder.includes(exercise.id)) {
        setExercisesOrder([...exercisesOrder, exercise.id]);
      }

      // Clear search and jump to step 3
      setSearchQuery("");
      setExercises([]);
      setIsSearchActive(false);
      setStep(3);

      onExerciseAdded?.();
    },
    [exercisesByMuscle, exercisesOrder, setExercisesByMuscle, setExercisesOrder, setStep, onExerciseAdded]
  );

  const handleClearSearch = () => {
    setSearchQuery("");
    setExercises([]);
  };

  const handleFocus = () => {
    setIsSearchActive(true);
  };

  const handleBlur = () => {
    // Delay to allow click on results
    setTimeout(() => {
      if (!searchQuery.trim()) {
        setIsSearchActive(false);
      }
    }, 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setSearchQuery("");
      setExercises([]);
    }
  };

  return (
    <div className="mb-6">
      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            autoComplete="off"
            className={cn(
              "w-full pl-10 pr-10 py-3 bg-white dark:bg-slate-800",
              "border-2 border-slate-200 dark:border-slate-700",
              "rounded-xl text-gray-900 dark:text-white placeholder-gray-500",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
              "transition-all duration-200",
              isSearchActive && "shadow-lg"
            )}
            onBlur={handleBlur}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder={t("workout_builder.quick_search_placeholder")}
            type="text"
            value={searchQuery}
          />
          {searchQuery && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
              onClick={handleClearSearch}
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {isSearchActive && (searchQuery.trim() || isLoading) && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-200 dark:border-slate-700 shadow-xl z-50 overflow-hidden max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="ml-2 text-gray-600 dark:text-gray-400">{t("commons.loading")}...</span>
              </div>
            ) : exercises.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {exercises.map((exercise) => (
                  <div
                    className="p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors group"
                    key={exercise.id}
                    onClick={() => handleAddExercise(exercise)}
                  >
                    <div className="flex items-center gap-3">
                      {/* Exercise Image */}
                      {exercise.fullVideoImageUrl ? (
                        <div className="relative h-12 w-12 rounded-lg overflow-hidden shrink-0 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600">
                          <Image
                            alt={exercise.nameEn || exercise.name}
                            className="w-full h-full object-cover scale-[1.5]"
                            height={48}
                            loading="lazy"
                            src={exercise.fullVideoImageUrl}
                            width={48}
                          />
                        </div>
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                          <Search className="h-5 w-5 text-gray-400" />
                        </div>
                      )}

                      {/* Exercise Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {exercise.nameEn || exercise.name}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                          {getMuscleFromExercise(exercise).replace(/_/g, " ").toLowerCase()}
                        </p>
                      </div>

                      {/* Add Button */}
                      <button
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddExercise(exercise);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        {t("commons.add")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : searchQuery.trim() ? (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                {t("workout_builder.no_exercises_found")}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Helper text */}
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
        {t("workout_builder.quick_search_hint")}
      </p>
    </div>
  );
}
