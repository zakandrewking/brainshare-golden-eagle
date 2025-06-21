import React, { useEffect, useState } from "react";

import { LoadingSpinner } from "@/components/ui/loading";
import { Progress } from "@/components/ui/progress";

interface SearchProgressIndicatorProps {
  isActive: boolean;
  onComplete?: () => void;
}

const PROGRESS_PHASES = [
  { progress: 15, duration: 3000, message: "Analyzing your selected data..." },
  { progress: 55, duration: 13000, message: "Finding relevant citations..." },
  { progress: 75, duration: 10000, message: "Verifying source credibility..." },
  { progress: 90, duration: 4000, message: "Preparing results..." },
];

const OVERTIME_MESSAGES = [
  "Still working hard to find the best citations...",
  "Quality citations take time to find...",
  "Almost there, found some promising sources...",
  "Just a few more seconds...",
  "Putting the finishing touches on your citations...",
];

export function SearchProgressIndicator({
  isActive,
  onComplete,
}: SearchProgressIndicatorProps) {
  const [progress, setProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isOvertime, setIsOvertime] = useState(false);
  const [overtimeMessageIndex, setOvertimeMessageIndex] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      setCurrentMessage("");
      setIsOvertime(false);
      setOvertimeMessageIndex(0);
      return;
    }

    let timeoutId: NodeJS.Timeout;
    let phaseIndex = 0;

    const runPhase = () => {
      if (phaseIndex >= PROGRESS_PHASES.length) {
        // Enter overtime mode
        setIsOvertime(true);
        setProgress(95);

        const cycleOvertimeMessages = () => {
          setOvertimeMessageIndex(
            (prev) => (prev + 1) % OVERTIME_MESSAGES.length
          );
          timeoutId = setTimeout(cycleOvertimeMessages, 3000);
        };

        cycleOvertimeMessages();
        return;
      }

      const phase = PROGRESS_PHASES[phaseIndex];
      const previousProgress =
        phaseIndex > 0 ? PROGRESS_PHASES[phaseIndex - 1].progress : 0;

      setCurrentMessage(phase.message);

      // Animate progress smoothly to the target
      const progressDiff = phase.progress - previousProgress;
      const steps = 200;
      const stepSize = progressDiff / steps;
      const stepDuration = phase.duration / steps;

      let currentStep = 0;

      const animateProgress = () => {
        if (currentStep < steps) {
          setProgress(previousProgress + stepSize * currentStep);
          currentStep++;
          timeoutId = setTimeout(animateProgress, stepDuration);
        } else {
          setProgress(phase.progress);
          phaseIndex++;
          timeoutId = setTimeout(runPhase, 500); // Small pause between phases
        }
      };

      animateProgress();
    };

    // Start the first phase
    runPhase();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isActive]);

  // Complete the progress when external operation finishes
  useEffect(() => {
    if (!isActive && progress > 0) {
      setProgress(100);
      setCurrentMessage("Citations found!");
      const completeTimeout = setTimeout(() => {
        onComplete?.();
      }, 500);

      return () => clearTimeout(completeTimeout);
    }
  }, [isActive, progress, onComplete]);

  if (!isActive && progress === 0) {
    return null;
  }

  const displayMessage = isOvertime
    ? OVERTIME_MESSAGES[overtimeMessageIndex]
    : currentMessage;

  return (
    <div className="space-y-6 py-8">
      <div className="flex items-center justify-center gap-3">
        <LoadingSpinner className="h-5 w-5 text-primary" />
      </div>

      <div className="space-y-4">
        <div className="text-center">
          <div className="text-sm font-medium text-foreground mb-2">
            {displayMessage}
          </div>
          <div className="text-xs text-muted-foreground">
            {isOvertime && "Taking a bit longer than usual..."}
          </div>
        </div>

        <div className="space-y-2">
          <Progress value={progress} className="w-full h-2" />
        </div>

        {isOvertime && (
          <div className="text-center text-xs text-muted-foreground italic">
            Good things take time! We&apos;re finding the highest quality
            citations.
          </div>
        )}
      </div>
    </div>
  );
}
