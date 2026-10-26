export type NotificationChannel = 'email' | 'webhook';

export type NotificationProvider = 'resend' | 'sendgrid' | 'smtp';

export type NotificationEvent =
  | 'quorum_requested'
  | 'quorum_approved'
  | 'compliance_violation'
  | 'clearance_changed';

export type NotificationSeverity = 'info' | 'warning' | 'critical';

export interface NotificationRecipient {
  id: string;
  name: string;
  handle?: string;
  email?: string;
  role?: string;
  tier?: string;
  notify_channels?: string[];
  notify_events?: string[];
}

export interface NotificationPayload {
  event: NotificationEvent;
  repo: string;
  title: string;
  message: string;
  prNumber?: number;
  actionUrl?: string;
  author?: string;
  recipients?: NotificationRecipient[];
  details?: Record<string, unknown>;
  severity?: NotificationSeverity;
  /** Cor da taxonomia dinâmica lida do .project.config.json para badges visuais */
  statusColor?: string;
}

export interface NotificationProjectConfig {
  enabled?: boolean;
  cooldown_minutes?: number;
  channels?: {
    email?: {
      enabled?: boolean;
      provider?: NotificationProvider;
      sender_address?: string;
      sender_name?: string;
    };
    webhook?: {
      enabled?: boolean;
      url?: string;
    };
  };
  events?: {
    on_quorum_requested?: boolean;
    on_quorum_approved?: boolean;
    on_compliance_violation?: boolean;
    on_clearance_changed?: boolean;
  };
}

export interface ChannelDispatchResult {
  channel: NotificationChannel;
  success: boolean;
  error?: string;
  skippedCooldown?: boolean;
  recipientCount?: number;
}

export interface NotificationDispatchResult {
  success: boolean;
  skippedAllCooldown?: boolean;
  channelResults: ChannelDispatchResult[];
}
