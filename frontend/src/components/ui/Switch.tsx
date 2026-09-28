import React from "react";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className = "",
  id,
}) => {
  const switchElement = (
    <label className="ui-switch" style={{ opacity: disabled ? 0.6 : 1 }}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="ui-switch__slider" />
    </label>
  );

  if (!label && !description) {
    return switchElement;
  }

  return (
    <div
      className={`ui-switch-wrap ${className}`.trim()}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
    >
      <div className="ui-switch-label-wrap">
        {label && <span className="ui-switch-label">{label}</span>}
        {description && <span className="ui-switch-desc">{description}</span>}
      </div>
      {switchElement}
    </div>
  );
};
