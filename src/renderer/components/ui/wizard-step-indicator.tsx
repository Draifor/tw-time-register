import React from 'react';

/**
 * Small visible stepper shared by the wizard dialogs. The current step is
 * announced both by the visible "Step X of Y" text and by `aria-current="step"`,
 * so it never relies on color alone (UX-404).
 */
export function WizardStepIndicator({
  labels,
  currentIndex,
  progressLabel,
  ariaLabel
}: {
  labels: string[];
  currentIndex: number;
  progressLabel: string;
  ariaLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{progressLabel}</p>
      <ol aria-label={ariaLabel} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {labels.map((label, index) => {
          const isCurrent = index === currentIndex;
          return (
            <li
              key={label}
              aria-current={isCurrent ? 'step' : undefined}
              className={`flex items-center gap-1.5 ${
                isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full border text-[10px] ${
                  isCurrent ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                }`}
              >
                {index + 1}
              </span>
              <span>{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
