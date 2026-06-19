export type EventStatus = 'draft' | 'active' | 'finished' | 'archived';

export interface Event {
  id: string;
  owner_admin_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  theme_color: string;
  status: EventStatus;
  created_at: string;
  updated_at: string;
}

export interface Participant {
  id: string;
  event_id: string;
  external_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  event_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface ParticipantGroup {
  participant_id: string;
  group_id: string;
  created_at: string;
}

export interface ParticipantWithGroups extends Participant {
  groups: Group[];
}

export interface GroupWithCount extends Group {
  member_count: number;
}

export interface Action {
  id: string;
  event_id: string;
  code: string;
  name: string;
  points: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PointTransaction {
  id: string;
  event_id: string;
  participant_id: string;
  action_id: string;
  points: number;
  created_by: string;
  created_at: string;
}

export interface PointTransactionWithDetails extends PointTransaction {
  participant: Pick<Participant, 'name' | 'external_id'>;
  action: Pick<Action, 'name' | 'code'>;
}

export interface ParticipantLeaderboardEntry {
  participant_id: string;
  participant_name: string;
  external_id: string;
  total_points: number;
}

export interface GroupLeaderboardEntry {
  group_id: string;
  group_name: string;
  group_color: string;
  total_points: number;
}

export type DashboardTab = 'event' | 'participants' | 'groups' | 'actions' | 'score' | 'leaderboard';
