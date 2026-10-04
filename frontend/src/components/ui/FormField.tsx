import React from "react";
import { AlertCircle } from "lucide-react";

export interface FormFieldProps {
  label?: React.ReactNode;
  required?: boolean;
  helperText?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  required,
  helperText,
  error,
  children,
  className = "",
  htmlFor,
}) => {
  return (
    <div className={`ui-form-field ${className}`.trim()}>
      {label && (
        <label className="ui-form-label" htmlFor={htmlFor}>
          {label}
          {required && <span className="ui-form-label__required">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <div className="ui-form-error" role="alert">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      ) : (
        helperText && <div className="ui-form-helper">{helperText}</div>
      )}
    </div>
  );
};
