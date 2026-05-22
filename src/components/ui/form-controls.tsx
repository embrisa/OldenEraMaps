import { ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/radix";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn("oe-input", className)} {...props} />
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn("oe-textarea", className)} {...props} />
);
Textarea.displayName = "Textarea";

export function HelpIcon({ tooltip, detail }: { tooltip: string; detail?: string }): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="oe-help" role="img" aria-label="Help" tabIndex={0}>?</span>
      </TooltipTrigger>
      <TooltipContent className="oe-tooltip--rich">
        <p className="oe-tooltip__summary">{tooltip}</p>
        {detail ? <p className="oe-tooltip__detail">{detail}</p> : null}
      </TooltipContent>
    </Tooltip>
  );
}

export function Field({
  label,
  help,
  helpDetail,
  children,
  className
}: {
  label: React.ReactNode;
  help?: string;
  helpDetail?: string;
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  const labelId = React.useId();
  const content = React.isValidElement<{ "aria-labelledby"?: string }>(children)
    ? React.cloneElement(children, {
      "aria-labelledby": children.props["aria-labelledby"] ?? labelId
    })
    : children;

  return (
    <div className={cn("oe-field", className)}>
      <span id={labelId} className="oe-field__label">
        {label}
        {help ? <HelpIcon tooltip={help} detail={helpDetail} /> : null}
      </span>
      {content}
    </div>
  );
}

export function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>): React.JSX.Element {
  const { children, className, ...rest } = props;

  return (
    <div className="oe-select-shell">
      <select className={cn("oe-select", className)} role="combobox" {...rest}>
        {children}
      </select>
      <span className="oe-select__icon" aria-hidden="true">
        <ChevronDown size={15} />
      </span>
    </div>
  );
}

type SteppedValueSliderProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;
type NumericAttribute = number | string | readonly string[] | undefined;

function parseNumericAttribute(value: NumericAttribute): number | undefined {
  if (value === undefined || value === "" || Array.isArray(value)) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getStepPrecision(step: number | undefined): number {
  if (!step || !Number.isFinite(step)) {
    return 0;
  }

  const decimals = `${step}`.split(".")[1];
  return decimals ? decimals.length : 0;
}

function formatSliderValue(value: NumericAttribute, precision = 0): string {
  const parsed = parseNumericAttribute(value);
  if (parsed === undefined) {
    return "";
  }

  if (precision === 0) {
    return `${Math.round(parsed)}`;
  }

  return parsed.toFixed(precision).replace(/(?:\.0+|(?:(\.\d*?)0+))$/, "$1");
}

function clampAndSnapValue(rawValue: number, min: number | undefined, max: number | undefined, step: number | undefined): number {
  let nextValue = rawValue;

  if (min !== undefined) {
    nextValue = Math.max(nextValue, min);
  }

  if (max !== undefined) {
    nextValue = Math.min(nextValue, max);
  }

  if (step !== undefined && step > 0) {
    const base = min ?? 0;
    const steps = Math.round((nextValue - base) / step);
    nextValue = base + (steps * step);

    if (min !== undefined) {
      nextValue = Math.max(nextValue, min);
    }

    if (max !== undefined) {
      nextValue = Math.min(nextValue, max);
    }
  }

  return nextValue;
}

export function SteppedValueSlider({
  className,
  value,
  min,
  max,
  step,
  onChange,
  onBlur,
  onKeyDown,
  disabled,
  ...props
}: SteppedValueSliderProps): React.JSX.Element {
  const minValue = parseNumericAttribute(min);
  const maxValue = parseNumericAttribute(max);
  const stepValue = parseNumericAttribute(step) ?? 1;
  const precision = getStepPrecision(stepValue);
  const formattedValue = formatSliderValue(value, precision);
  const [draftValue, setDraftValue] = React.useState(formattedValue);

  React.useEffect(() => {
    setDraftValue(formattedValue);
  }, [formattedValue]);

  const commitDraftValue = React.useCallback(() => {
    const parsed = Number(draftValue);
    if (!Number.isFinite(parsed)) {
      setDraftValue(formattedValue);
      return;
    }

    const normalized = clampAndSnapValue(parsed, minValue, maxValue, stepValue);
    const nextValue = formatSliderValue(normalized, precision);
    setDraftValue(nextValue);

    onChange?.({
      currentTarget: { value: nextValue },
      target: { value: nextValue }
    } as React.ChangeEvent<HTMLInputElement>);
  }, [draftValue, formattedValue, maxValue, minValue, onChange, precision, stepValue]);

  const sliderFill = React.useMemo(() => {
    const numericValue = parseNumericAttribute(value) ?? minValue ?? 0;
    if (minValue === undefined || maxValue === undefined || maxValue <= minValue) {
      return 0;
    }

    return ((numericValue - minValue) / (maxValue - minValue)) * 100;
  }, [maxValue, minValue, value]);

  return (
    <div className={cn("oe-value-slider", className)} data-disabled={disabled ? "true" : "false"}>
      <div className="oe-value-slider__main">
        <input
          {...props}
          className="oe-slider"
          disabled={disabled}
          max={max}
          min={min}
          onChange={(event) => {
            setDraftValue(event.currentTarget.value);
            onChange?.(event);
          }}
          step={step}
          style={{ "--oe-slider-fill": `${Math.min(Math.max(sliderFill, 0), 100)}%` } as React.CSSProperties}
          type="range"
          value={value}
        />
        <Input
          aria-label={props["aria-label"]}
          aria-labelledby={props["aria-labelledby"]}
          className="oe-slider__value"
          disabled={disabled}
          max={max}
          min={min}
          onBlur={(event) => {
            commitDraftValue();
            onBlur?.(event);
          }}
          onChange={(event) => {
            setDraftValue(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commitDraftValue();
            }

            onKeyDown?.(event);
          }}
          step={step}
          type="number"
          value={draftValue}
        />
      </div>
      {minValue !== undefined && maxValue !== undefined ? (
        <div className="oe-slider__bounds" aria-hidden="true">
          <span>{formatSliderValue(minValue, precision)}</span>
          <span>{formatSliderValue(maxValue, precision)}</span>
        </div>
      ) : null}
    </div>
  );
}
