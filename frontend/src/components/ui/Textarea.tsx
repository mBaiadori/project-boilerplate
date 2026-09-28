import React from "react";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ hasError = false, className = "", ...props }, ref) => {
    const errorClass = hasError ? "ui-textarea--error" : "";

    return (
      <textarea
        ref={ref}
        className={`ui-textarea ${errorClass} ${className}`.trim()}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";
