import React from "react";

export type SpinnerSize = "sm" | "md" | "lg";

export interface SpinnerProps {
  size?: SpinnerSize;
  message?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = "md",
  message,
  className = "",
  style,
}) => {
  const spinnerClass = `ui-spinner--${size}`;

  if (!message) {
    return (
      <span
        className={`ui-spinner ${spinnerClass} ${className}`.trim()}
        style={style}
      />
    );
  }

  return (
    <div className={`ui-spinner-wrap ${className}`.trim()} style={style}>
      <span className={`ui-spinner ${spinnerClass}`} />
      <span className="ui-spinner__text">{message}</span>
    </div>
  );
};
