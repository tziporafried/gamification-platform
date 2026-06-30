export type EventStatus = 'editing' | 'active' | 'archived';

export type UserRole = 'super_admin' | 'user';
export type UserPlan = 'free' | 'independent' | 'full' | 'organizations';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  plan: UserPlan;
  created_at: string;
  updated_at: string;
}

export type StepStatus = 'not_started' | 'in_progress' | 'completed';
export type WizardStepId = 'details' | 'groups' | 'participants' | 'tasks' | 'rewards' | 'review';
export type GroupType = 'none' | 'custom';

export interface WizardState {
  details: StepStatus;
  groups: StepStatus;
  participants: StepStatus;
  tasks: StepStatus;
  rewards: StepStatus;
  review: StepStatus;
}

export interface ReadinessCheck {
  id: string
  label: string
  passed: boolean
  required: boolean
  stepNumber?: number
  wizardPassedLabel?: string
  wizardFailedLabel?: string
}

export interface EventCounts {
  participants: number;
  groups: number;
  tasks: number;
  transactions: number;
  rewards: number;
}

export interface WizardPrefs {
  lastStep: number;
  groupType: GroupType | null;
}

export interface ActivityTemplate {
  id: string;
  name: string;
  description: string | null;
  group_type: 'none' | 'custom';
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ActivityTemplateGroup {
  id: string;
  activity_template_id: string;
  name: string;
  color: string;
  sort_order: number;
}

export interface TemplateTask {
  id: string;
  name: string;
  points: number;
  description: string | null;
  max_completions: number | null;
  sort_order: number;
  eligible_group_names: string[];
}

export interface TemplateReward {
  id: string;
  name: string;
  required_points: number;
  sort_order: number;
}

export interface ActivityTemplateWithContent extends ActivityTemplate {
  groups: ActivityTemplateGroup[];
  tasks: TemplateTask[];
  rewards: TemplateReward[];
}

export interface LockedTemplateStore {
  templateId: string;
  templateName: string;
  groups: ActivityTemplateGroup[];
  tasks: TemplateTask[];
  rewards: TemplateReward[];
}

export interface TemplateImportResult {
  templateName: string;
  groupType: GroupType;
  imported: { groups: number; tasks: number; rewards: number };
  total: { groups: number; tasks: number; rewards: number };
  importedNames: { groups: string[]; tasks: string[]; rewards: string[] };
  lockedNames: { groups: string[]; tasks: string[]; rewards: string[] };
  isPartial: boolean;
}

export interface Event {
  id: string;
  owner_admin_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  theme_color?: string;
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
  max_completions: number | null;
  created_at: string;
  updated_at: string;
  // Time-based fields (migration 021)
  time_enabled: boolean;
  start_at: string | null;
  end_at: string | null;
  duration_minutes: number | null;
  speed_bonus_enabled: boolean;
  speed_bonus_minutes: number | null;
  speed_bonus_flat_points: number | null;
  speed_multiplier: number;
}

export interface ActionWithGroups extends Action {
  groups: Group[];
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

export interface Reward {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  required_points: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RewardWithGroups extends Reward {
  groups: Group[];
}

export interface ParticipantReward {
  id: string;
  event_id: string;
  participant_id: string;
  reward_id: string;
  score_at_award: number;
  awarded_at: string;
}

export interface NewlyAwardedReward {
  out_reward_id: string;
  out_reward_name: string;
  out_reward_description: string | null;
  out_required_points: number;
  out_total_points: number;
}

export type DevTodoStatus = 'todo' | 'in_progress' | 'done';
export type DevTodoPriority = 'low' | 'medium' | 'high';

export interface DevTodo {
  id: string;
  title: string;
  description: string | null;
  status: DevTodoStatus;
  priority: DevTodoPriority;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DevTodoWithAssignee extends DevTodo {
  assignee?: { display_name: string | null; email: string; avatar_url: string | null };
}

export const WIZARD_STEPS: { id: WizardStepId; label: string; step: number }[] = [
  { id: 'details', label: 'פרטי הפעילות', step: 1 },
  { id: 'groups', label: 'חלוקה לקבוצות', step: 2 },
  { id: 'participants', label: 'מי משתתף?', step: 3 },
  { id: 'tasks', label: 'צבירת נקודות', step: 4 },
  { id: 'rewards', label: 'פרסים', step: 5 },
  { id: 'review', label: 'מוכנים להתחיל?', step: 6 },
];
