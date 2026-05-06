import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface BaseProps {
  name: string;
  label?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}

interface InputFieldProps
  extends BaseProps,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name' | 'required' | 'className'> {
  as?: 'input';
}

interface TextareaFieldProps
  extends BaseProps,
    Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'name' | 'required' | 'className'> {
  as: 'textarea';
}

type Props = InputFieldProps | TextareaFieldProps;

export function FormField(props: Props) {
  const { name, label, hint, required, className, ...rest } = props;
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label htmlFor={name}>
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
      )}
      {props.as === 'textarea' ? (
        <Textarea id={name} name={name} required={required} {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : (
        <Input id={name} name={name} required={required} {...(rest as React.InputHTMLAttributes<HTMLInputElement>)} />
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Native <select> with shadcn-style class. */
export function SelectField({
  name, label, options, defaultValue, required, hint, className,
}: BaseProps & {
  options: Array<string | { value: string; label: string }>;
  defaultValue?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label htmlFor={name}>
          {label}{required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
      )}
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((o) => {
          const v = typeof o === 'string' ? o : o.value;
          const l = typeof o === 'string' ? o : o.label;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
