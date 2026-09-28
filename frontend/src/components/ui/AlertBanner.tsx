import React from "react";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";

export type AlertType = "success" | "error" | "warning" | "info";

export interface AlertBannerProps {
  type?: AlertType;
  variant?: AlertType;
  title?: React.ReactNode;
  message?: React.ReactNode;
  children?: React.ReactNode;
  onClose?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  type,
  variant = "info",
  title,
  message,
  children,
  onClose,
  action,
  className = "",
}) => {
  const alertType = type || variant;

  const getIcon = () => {
    switch (alertType) {
      case "success":
        return <CheckCircle2 size={18} className="ui-alert__icon" />;
      case "error":
        return <AlertCircle size={18} className="ui-alert__icon" />;
      case "warning":
        return <AlertTriangle size={18} className="ui-alert__icon" />;
      case "info":
      default:
        return <Info size={18} className="ui-alert__icon" />;
    }
  };

  return (
    <div className={`ui-alert ui-alert--${alertType} ${className}`.trim()} role="alert">
      {getIcon()}
      <div className="ui-alert__content">
        {title && <h4 className="ui-alert__title">{title}</h4>}
        {(message || children) && (
          <div className="ui-alert__message">{message || children}</div>
        )}
      </div>
      {action && <div className="ui-alert__action">{action}</div>}
      {onClose && (
        <button
          type="button"
          className="ui-alert__close"
          onClick={onClose}
          aria-label="Fechar alerta"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};
