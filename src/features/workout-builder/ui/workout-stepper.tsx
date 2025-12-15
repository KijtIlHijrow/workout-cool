"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useQueryState } from "nuqs";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Bookmark } from "lucide-react";
import { ExerciseAttributeValueEnum } from "@prisma/client";

import { useCurrentLocale, useI18n } from "locales/client";
import Trophy from "@public/images/trophy.png";
import useBoolean from "@/shared/hooks/useBoolean";
import { TemplateList } from "@/features/workout-templates/ui/template-list";
import { SaveTemplateModal } from "@/features/workout-templates/ui/save-template-modal";
import { updateTemplate } from "@/features/workout-templates/actions/update-template.action";
import { getTemplates, WorkoutTemplateWithExercises } from "@/features/workout-templates/actions/get-templates.action";
import { deleteTemplate } from "@/features/workout-templates/actions/delete-template.action";
import { createTemplate } from "@/features/workout-templates/actions/create-template.action";
import { WorkoutSessionSets } from "@/features/workout-session/ui/workout-session-sets";
import { WorkoutSessionHeader } from "@/features/workout-session/ui/workout-session-header";
import { WorkoutBuilderFooter } from "@/features/workout-builder/ui/workout-stepper-footer";
import { env } from "@/env";
import { Button } from "@/components/ui/button";
import { HorizontalTopBanner } from "@/components/ads";

import { StepperStepProps } from "../types";
import { useWorkoutStepper } from "../hooks/use-workout-stepper";
import { useWorkoutSession } from "../../workout-session/model/use-workout-session";
import { StepperHeader } from "./stepper-header";
import { MuscleSelection } from "./muscle-selection";
import { ExercisesSelection } from "./exercises-selection";
import { EquipmentSelection } from "./equipment-selection";
import { AddExerciseModal } from "./add-exercise-modal";

import type { ExerciseWithAttributes, WorkoutBuilderStep } from "../types";

// Helper to extract attribute name from union type (can be enum string or object with .name)
const getAttributeName = (attr: { attributeName: unknown }): string => {
  const name = attr.attributeName;
  if (typeof name === "string") return name;
  if (name && typeof name === "object" && "name" in name) return String(name.name);
  return "";
};

// Helper to extract attribute value from union type (can be enum string or object with .value)
const getAttributeValue = (attr: { attributeValue: unknown }): string => {
  const value = attr.attributeValue;
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "value" in value) return String(value.value);
  return "";
};

export function WorkoutStepper() {
  const { loadSessionFromLocal } = useWorkoutSession();

  const t = useI18n();
  const router = useRouter();
  const [fromSession, setFromSession] = useQueryState("fromSession");
  const {
    currentStep,
    selectedEquipment,
    selectedMuscles,
    exercisesByMuscle,
    isLoadingExercises,
    exercisesError,
    nextStep,
    prevStep,
    toggleEquipment,
    clearEquipment,
    toggleMuscle,
    canProceedToStep2,
    canProceedToStep3,
    fetchExercises,
    exercisesOrder,
    shuffleExercise,
    pickExercise,
    shufflingExerciseId,
    goToStep,
    deleteExercise,
    loadFromSession,
    resetBuilder,
  } = useWorkoutStepper();
  const locale = useCurrentLocale();
  useEffect(() => {
    loadSessionFromLocal();
  }, []);

  // Template state
  const [templates, setTemplates] = useState<WorkoutTemplateWithExercises[]>([]);
  const [showTemplateSelection, setShowTemplateSelection] = useState(true);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingTemplateName, setEditingTemplateName] = useState<string>("");
  const saveTemplateModal = useBoolean();

  // Fetch templates on mount
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const fetchedTemplates = await getTemplates();
        setTemplates(fetchedTemplates);
      } catch (error) {
        console.error("Error fetching templates:", error);
      } finally {
        setIsLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, []);

  const [flatExercises, setFlatExercises] = useState<{ id: string; muscle: string; exercise: ExerciseWithAttributes }[]>([]);

  useEffect(() => {
    if (exercisesByMuscle.length > 0) {
      const flat = exercisesByMuscle.flatMap((group) =>
        group.exercises.map((exercise: ExerciseWithAttributes) => ({
          id: exercise.id,
          muscle: group.muscle,
          exercise,
        })),
      );
      setFlatExercises(flat);
    }
  }, [exercisesByMuscle]);

  useEffect(() => {
    // Only fetch exercises if we're on step 3, not from a session, AND no exercises exist yet
    // This prevents overwriting exercises added via quick search
    if (currentStep === 3 && !fromSession && exercisesByMuscle.length === 0) {
      fetchExercises();
    }
  }, [currentStep, fromSession, exercisesByMuscle.length]);

  const { isWorkoutActive, session, startWorkout, quitWorkout } = useWorkoutSession();

  const canContinue = currentStep === 1 ? canProceedToStep2 : currentStep === 2 ? canProceedToStep3 : exercisesByMuscle.length > 0;

  const handleShuffleExercise = async (exerciseId: string, muscle: string) => {
    try {
      const muscleEnum = muscle as ExerciseAttributeValueEnum;
      await shuffleExercise(exerciseId, muscleEnum);
    } catch (error) {
      console.error("Error shuffling exercise:", error);
      alert("Error shuffling exercise. Please try again.");
    }
  };

  const handlePickExercise = async (exerciseId: string) => {
    try {
      await pickExercise(exerciseId);
      console.log("Exercise picked successfully!");
    } catch (error) {
      console.error("Error picking exercise:", error);
      alert("Error picking exercise. Please try again.");
    }
  };

  const handleDeleteExercise = (exerciseId: string) => {
    deleteExercise(exerciseId);
  };

  const addExerciseModal = useBoolean();

  const handleAddExercise = () => {
    addExerciseModal.setTrue();
  };

  // Fix: Use flatExercises as the source of truth, respecting exercisesOrder when possible
  const orderedExercises = useMemo(() => {
    if (flatExercises.length === 0) return [];

    if (exercisesOrder.length === 0) {
      // No custom order, use flatExercises as-is
      return flatExercises.map((item) => item.exercise);
    }

    // Create a map for quick lookup
    const exerciseMap = new Map(flatExercises.map((item) => [item.id, item.exercise]));

    // Get ordered exercises that exist in flatExercises
    const orderedResults = exercisesOrder.map((id) => exerciseMap.get(id)).filter(Boolean) as ExerciseWithAttributes[];

    // Add any remaining exercises from flatExercises that aren't in exercisesOrder
    const remainingExercises = flatExercises.filter((item) => !exercisesOrder.includes(item.id)).map((item) => item.exercise);

    return [...orderedResults, ...remainingExercises];
  }, [flatExercises, exercisesOrder]);

  const handleStartWorkout = () => {
    if (orderedExercises.length > 0) {
      startWorkout(orderedExercises, selectedEquipment, selectedMuscles);
    } else {
      console.log("🚀 [WORKOUT-STEPPER] No exercises to start workout with!");
    }
  };

  const [showCongrats, setShowCongrats] = useState(false);

  const goToProfile = () => {
    router.push("/profile");
  };

  const handleCongrats = () => {
    setShowCongrats(true);
  };

  // Template handlers
  const handleStartFromTemplate = useCallback((template: WorkoutTemplateWithExercises) => {
    const exercises = template.exercises.map((te) => te.exercise as ExerciseWithAttributes);
    if (exercises.length > 0) {
      startWorkout(exercises, template.equipment, template.muscles);
    }
  }, [startWorkout]);

  const handleEditTemplate = useCallback((template: WorkoutTemplateWithExercises) => {
    // Track which template we're editing
    setEditingTemplateId(template.id);
    setEditingTemplateName(template.name);

    // Group exercises by muscle for the stepper format
    const exercisesByMuscleMap = new Map<ExerciseAttributeValueEnum, ExerciseWithAttributes[]>();

    template.exercises.forEach((te) => {
      const exercise = te.exercise as ExerciseWithAttributes;
      // Find the muscle attribute for this exercise
      const muscleAttribute = exercise.attributes?.find(
        (attr) => getAttributeName(attr) === "PRIMARY_MUSCLE"
      );
      const muscle = muscleAttribute ? getAttributeValue(muscleAttribute) as ExerciseAttributeValueEnum : undefined;

      if (muscle) {
        const existing = exercisesByMuscleMap.get(muscle) || [];
        exercisesByMuscleMap.set(muscle, [...existing, exercise]);
      }
    });

    // Convert map to array format expected by loadFromSession
    const exercisesByMuscle = Array.from(exercisesByMuscleMap.entries()).map(([muscle, exercises]) => ({
      muscle,
      exercises,
    }));

    // Get exercise order from template
    const exercisesOrder = template.exercises.map((te) => te.exercise.id);

    // Load into the stepper
    loadFromSession({
      equipment: template.equipment as ExerciseAttributeValueEnum[],
      muscles: template.muscles as ExerciseAttributeValueEnum[],
      exercisesByMuscle,
      exercisesOrder,
    });

    // Hide template selection to show the stepper
    setShowTemplateSelection(false);
  }, [loadFromSession]);

  const handleDeleteTemplate = useCallback(async (template: WorkoutTemplateWithExercises) => {
    if (!window.confirm(t("workout_templates.delete_confirm"))) return;

    try {
      await deleteTemplate(template.id);
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
    } catch (error) {
      console.error("Error deleting template:", error);
    }
  }, [t]);

  const handleBuildNew = useCallback(() => {
    resetBuilder();
    setEditingTemplateId(null);
    setEditingTemplateName("");
    setShowTemplateSelection(false);
  }, [resetBuilder]);

  const handleSaveTemplate = useCallback(async (name: string) => {
    setIsSavingTemplate(true);
    try {
      // Derive muscles from actual exercises' PRIMARY_MUSCLE attributes
      const derivedMuscles = [
        ...new Set(
          orderedExercises
            .map((ex) => {
              const muscleAttr = ex.attributes?.find((attr) => getAttributeName(attr) === "PRIMARY_MUSCLE");
              return muscleAttr ? getAttributeValue(muscleAttr) as ExerciseAttributeValueEnum : undefined;
            })
            .filter((muscle): muscle is ExerciseAttributeValueEnum => muscle !== undefined)
        ),
      ];

      const exerciseData = orderedExercises.map((ex, index) => ({
        exerciseId: ex.id,
        order: index,
      }));

      if (editingTemplateId) {
        // Update existing template
        const updatedTemplate = await updateTemplate({
          id: editingTemplateId,
          name,
          equipment: selectedEquipment,
          muscles: derivedMuscles,
          exercises: exerciseData,
        });

        setTemplates((prev) =>
          prev.map((t) => (t.id === editingTemplateId ? (updatedTemplate as WorkoutTemplateWithExercises) : t))
        );
        setEditingTemplateId(null);
        setEditingTemplateName("");
        setShowTemplateSelection(true);
        alert(t("workout_templates.updated_success"));
      } else {
        // Create new template
        const newTemplate = await createTemplate({
          name,
          equipment: selectedEquipment,
          muscles: derivedMuscles,
          exercises: exerciseData,
        });

        setTemplates((prev) => [newTemplate as WorkoutTemplateWithExercises, ...prev]);
        alert(t("workout_templates.saved_success"));
      }

      saveTemplateModal.setFalse();
    } catch (error) {
      console.error("Error saving template:", error);
      alert("Error saving template");
    } finally {
      setIsSavingTemplate(false);
    }
  }, [orderedExercises, selectedEquipment, saveTemplateModal, t, editingTemplateId]);

  const handleToggleEquipment = (equipment: ExerciseAttributeValueEnum) => {
    toggleEquipment(equipment);
    if (fromSession) setFromSession(null);
  };

  const handleClearEquipment = () => {
    clearEquipment();
    if (fromSession) setFromSession(null);
  };

  const handleToggleMuscle = (muscle: ExerciseAttributeValueEnum) => {
    toggleMuscle(muscle);
    if (fromSession) setFromSession(null);
  };

  const handleStepClick = (stepNumber: number) => {
    if (stepNumber < currentStep) {
      goToStep(stepNumber as WorkoutBuilderStep);
    }
  };

  if (showCongrats && !isWorkoutActive) {
    return (
      <div className="flex flex-col items-center justify-center py-16 h-full">
        <Image alt="Trophée" className="w-56 h-56" src={Trophy} />
        <h2 className="text-2xl font-bold mb-2 text-center">{t("workout_builder.session.congrats")}</h2>
        <p className="text-lg text-slate-600 mb-6">{t("workout_builder.session.congrats_subtitle")}</p>
        <Button onClick={goToProfile}>{t("commons.go_to_profile")}</Button>
      </div>
    );
  }

  if (isWorkoutActive && session) {
    return (
      <div className="w-full max-w-6xl mx-auto">
        {env.NEXT_PUBLIC_TOP_WORKOUT_SESSION_BANNER_AD_SLOT && (
          <HorizontalTopBanner adSlot={env.NEXT_PUBLIC_TOP_WORKOUT_SESSION_BANNER_AD_SLOT} />
        )}
        {!showCongrats && <WorkoutSessionHeader onQuitWorkout={quitWorkout} />}
        <WorkoutSessionSets isWorkoutActive={isWorkoutActive} onCongrats={handleCongrats} showCongrats={showCongrats} />
      </div>
    );
  }

  // Show loading state while fetching templates (prevents flash to stepper)
  if (showTemplateSelection && isLoadingTemplates) {
    return (
      <div className="w-full max-w-6xl mx-auto h-full px-4 py-6 flex items-center justify-center">
        <div className="animate-pulse text-slate-500">{t("commons.loading")}</div>
      </div>
    );
  }

  // Show template selection (Step 0) if user has templates and hasn't started building
  if (showTemplateSelection && templates.length > 0) {
    return (
      <div className="w-full max-w-6xl mx-auto h-full px-4 py-6">
        <TemplateList
          onBuildNew={handleBuildNew}
          onDeleteTemplate={handleDeleteTemplate}
          onEditTemplate={handleEditTemplate}
          onStartTemplate={handleStartFromTemplate}
          templates={templates}
        />
      </div>
    );
  }

  const STEPPER_STEPS: StepperStepProps[] = [
    {
      stepNumber: 1,
      title: t("workout_builder.steps.equipment.title"),
      description: t("workout_builder.steps.equipment.description"),
      isActive: false,
      isCompleted: false,
    },
    {
      stepNumber: 2,
      title: t("workout_builder.steps.muscles.title"),
      description: t("workout_builder.steps.muscles.description"),
      isActive: false,
      isCompleted: false,
    },
    {
      stepNumber: 3,
      title: t("workout_builder.steps.exercises.title"),
      description: t("workout_builder.steps.exercises.description"),
      isActive: false,
      isCompleted: false,
    },
  ];

  const steps = STEPPER_STEPS.map((step) => ({
    ...step,
    isActive: step.stepNumber === currentStep,
    isCompleted: step.stepNumber < currentStep,
  }));

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <EquipmentSelection
            onClearEquipment={handleClearEquipment}
            onToggleEquipment={handleToggleEquipment}
            selectedEquipment={selectedEquipment}
          />
        );
      case 2:
        return (
          <MuscleSelection onToggleMuscle={handleToggleMuscle} selectedEquipment={selectedEquipment} selectedMuscles={selectedMuscles} />
        );
      case 3:
        return (
          <div className="space-y-4">
            <ExercisesSelection
              error={exercisesError}
              exercisesByMuscle={exercisesByMuscle}
              isLoading={isLoadingExercises}
              onAdd={handleAddExercise}
              onDelete={handleDeleteExercise}
              onPick={handlePickExercise}
              onShuffle={handleShuffleExercise}
              shufflingExerciseId={shufflingExerciseId}
            />
            {/* Show save as template button only when NOT editing an existing template */}
            {orderedExercises.length > 0 && !editingTemplateId && (
              <div className="flex justify-center pt-2">
                <Button onClick={saveTemplateModal.setTrue} size="small" variant="outline">
                  <Bookmark className="w-4 h-4 mr-2" />
                  {t("workout_templates.save_as_template")}
                </Button>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const renderTopBanner = () => {
    if (currentStep === 1) {
      if (env.NEXT_PUBLIC_TOP_STEPPER_STEP_1_BANNER_AD_SLOT || env.NEXT_PUBLIC_EZOIC_TOP_STEPPER_STEP_1_PLACEMENT_ID) {
        return (
          <HorizontalTopBanner
            adSlot={env.NEXT_PUBLIC_TOP_STEPPER_STEP_1_BANNER_AD_SLOT}
            ezoicPlacementId={env.NEXT_PUBLIC_EZOIC_TOP_STEPPER_STEP_1_PLACEMENT_ID}
          />
        );
      }
    }

    if (currentStep === 2) {
      if (env.NEXT_PUBLIC_TOP_STEPPER_STEP_2_BANNER_AD_SLOT || env.NEXT_PUBLIC_EZOIC_TOP_STEPPER_STEP_2_PLACEMENT_ID) {
        return (
          <HorizontalTopBanner
            adSlot={env.NEXT_PUBLIC_TOP_STEPPER_STEP_2_BANNER_AD_SLOT}
            ezoicPlacementId={env.NEXT_PUBLIC_EZOIC_TOP_STEPPER_STEP_2_PLACEMENT_ID}
          />
        );
      }
    }

    if (currentStep === 3) {
      if (env.NEXT_PUBLIC_TOP_STEPPER_STEP_3_BANNER_AD_SLOT || env.NEXT_PUBLIC_EZOIC_TOP_STEPPER_STEP_3_PLACEMENT_ID) {
        return (
          <HorizontalTopBanner
            adSlot={env.NEXT_PUBLIC_TOP_STEPPER_STEP_3_BANNER_AD_SLOT}
            ezoicPlacementId={env.NEXT_PUBLIC_EZOIC_TOP_STEPPER_STEP_3_PLACEMENT_ID}
          />
        );
      }
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto h-full">
      {renderTopBanner()}

      {!editingTemplateId && (
        <StepperHeader currentStep={currentStep} onStepClick={handleStepClick} steps={steps} />
      )}

      <div className={`px-2 sm:px-6 ${editingTemplateId ? "pt-6" : ""}`}>{renderStepContent()}</div>

      <WorkoutBuilderFooter
        canContinue={canContinue}
        currentStep={currentStep}
        editingTemplateName={editingTemplateName}
        isEditing={!!editingTemplateId}
        isSavingTemplate={isSavingTemplate}
        onNext={nextStep}
        onPrevious={prevStep}
        onSaveTemplate={() => handleSaveTemplate(editingTemplateName)}
        onStartWorkout={handleStartWorkout}
        onTemplateNameChange={setEditingTemplateName}
        totalSteps={STEPPER_STEPS.length}
      />

      <AddExerciseModal isOpen={addExerciseModal.value} onClose={addExerciseModal.setFalse} selectedEquipment={selectedEquipment} />

      {/* Save Template Modal */}
      <SaveTemplateModal
        initialName={editingTemplateName}
        isLoading={isSavingTemplate}
        isOpen={saveTemplateModal.value}
        onClose={saveTemplateModal.setFalse}
        onSave={handleSaveTemplate}
      />
    </div>
  );
}
