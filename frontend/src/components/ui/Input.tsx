import React from "react";
import { Search, X } from "lucide-react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  startIcon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  hasError?: boolean;
  clearable?: boolean;
  onClear?: () => void;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      startIcon,
      leftIcon,
      endIcon,
      rightIcon,
      hasError = false,
      clearable = false,
      onClear,
      value,
      className = "",
      ...props
    },
    ref,
  ) => {
    const errorClass = hasError ? "ui-input--error" : "";
    const prefixIcon = leftIcon || startIcon;
    const suffixIcon = rightIcon || endIcon;
    const leftPadClass = prefixIcon ? "ui-input--with-left-icon" : "";
    const rightPadClass =
      suffixIcon || onClear || clearable ? "ui-input--with-right-icon" : "";

    return (
      <div className="ui-input-wrap">
        {prefixIcon && <div className="ui-input-icon-left">{prefixIcon}</div>}
        <input
          ref={ref}
          value={value}
          style={{
            paddingLeft: prefixIcon ? '38px' : undefined,
            paddingRight: suffixIcon || onClear || clearable ? '38px' : undefined,
            ...props.style,
          }}
          className={`ui-input ${errorClass} ${leftPadClass} ${rightPadClass} ${className}`.trim()}
          {...props}
        />
        {(onClear || clearable) && value ? (
          <button
            type="button"
            className="ui-input-icon-right"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
            onClick={onClear}
            title="Limpar"
          >
            <X size={16} />
          </button>
        ) : (
          suffixIcon && <div className="ui-input-icon-right">{suffixIcon}</div>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export interface SearchInputProps
  extends Omit<InputProps, "startIcon" | "type"> {}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ placeholder = "Buscar...", onClear, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="text"
        placeholder={placeholder}
        startIcon={<Search size={16} />}
        onClear={onClear}
        clearable={!!onClear}
        {...props}
      />
    );
  },
);

SearchInput.displayName = "SearchInput";
