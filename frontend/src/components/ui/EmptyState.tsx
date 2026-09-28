import React from "react";
import { Inbox } from "lucide-react";
import { Button } from "./Button";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  actionLabel,
  onAction,
  className = "",
}) => {
  return (
    <div className={`ui-empty-state ${className}`.trim()}>
      <div className="ui-empty-state__icon">
        {icon || <Inbox size={42} strokeWidth={1.4} />}
      </div>
      <h4 className="ui-empty-state__title">{title}</h4>
      {description && (
        <p className="ui-empty-state__description">{description}</p>
      )}
      {(action || (actionLabel && onAction)) && (
        <div className="ui-empty-state__action">
          {action || (
            <Button variant="primary" size="md" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
