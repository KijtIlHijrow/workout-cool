"use client";

import { useState } from "react";
import { Play, MoreVertical, Pencil, Trash2, Dumbbell } from "lucide-react";

import { useI18n } from "locales/client";
import { cn } from "@/shared/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import type { WorkoutTemplateWithExercises } from "../actions/get-templates.action";

interface TemplateCardProps {
  template: WorkoutTemplateWithExercises;
  onStart: (template: WorkoutTemplateWithExercises) => void;
  onEdit: (template: WorkoutTemplateWithExercises) => void;
  onDelete: (template: WorkoutTemplateWithExercises) => void;
}

export function TemplateCard({ template, onStart, onEdit, onDelete }: TemplateCardProps) {
  const t = useI18n();
  const [showMenu, setShowMenu] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  const handleTouchStart = () => {
    const timer = setTimeout(() => {
      setShowMenu(true);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleClick = () => {
    if (!showMenu) {
      onStart(template);
    }
  };

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  return (
    <Card
      className={cn(
        "group relative overflow-hidden cursor-pointer",
        "bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-800 dark:to-slate-900",
        "border-2 border-blue-200 dark:border-slate-700",
        "rounded-xl shadow-sm hover:shadow-xl",
        "transition-all duration-300 ease-out",
        "hover:scale-[1.02] hover:-translate-y-1",
        "hover:border-blue-300 dark:hover:border-blue-600",
      )}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        setShowMenu(true);
      }}
      onTouchEnd={handleTouchEnd}
      onTouchStart={handleTouchStart}
    >
      <CardContent className="p-4 relative">
        {/* Menu button (desktop) */}
        <button
          className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 dark:bg-slate-700/80 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={handleMenuToggle}
        >
          <MoreVertical className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        </button>

        {/* Dropdown menu */}
        {showMenu && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
            <div className="absolute top-10 right-2 z-30 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[120px]">
              <button
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onEdit(template);
                }}
              >
                <Pencil className="w-4 h-4" />
                {t("commons.edit")}
              </button>
              <button
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onDelete(template);
                }}
              >
                <Trash2 className="w-4 h-4" />
                {t("commons.delete")}
              </button>
            </div>
          </>
        )}

        {/* Template content */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-500/20 dark:bg-blue-500/30 flex items-center justify-center">
            <Dumbbell className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-white truncate">{template.name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {template.exercises.length} {template.exercises.length === 1 ? "exercise" : "exercises"}
            </p>
          </div>
          <div className="flex-shrink-0">
            <Play className="w-6 h-6 text-blue-500 dark:text-blue-400" />
          </div>
        </div>

        {/* Muscle badges */}
        {template.muscles.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {template.muscles.slice(0, 3).map((muscle) => (
              <Badge className="text-xs" key={muscle} variant="outline">
                {muscle.replace(/_/g, " ").toLowerCase()}
              </Badge>
            ))}
            {template.muscles.length > 3 && (
              <Badge className="text-xs" variant="outline">
                +{template.muscles.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
