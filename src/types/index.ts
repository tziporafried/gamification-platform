export type EventStatus = 'editing' | 'active' | 'archived';

export type UserRole = 'super_admin' | 'user';
export type UserPlan = 'free' | 'independent' | 'full' | 'organizations' | 'offline';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  /** First-touch UTM attribution captured on register/login when present. */
  affiliate_attribution?: Record<string, string> | null;
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

export interface ControlCenterLiveStats {
  playersPlayed: number;
  activityTypesScanned: number;
  totalScans: number;
  totalPoints: number;
  rewardsEarned: number;
  activeGroups: number;
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
  draft_event_id: string | null;
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
  status: EventStatus;
  plan: UserPlan;
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
  daily_limit: boolean;
  daily_start_hour: number | null;
  daily_start_minute: number | null;
  daily_end_hour: number | null;
  daily_end_minute: number | null;
  created_at: string;
  updated_at: string;
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

export type RewardTargetType = 'all' | 'groups' | 'participant';
export type RewardWinnerMode = 'all' | 'first';

export interface Reward {
  id: string;
  event_id: string;
  name: string;
  required_points: number;
  is_active: boolean;
  target_type: RewardTargetType;
  target_participant_id: string | null;
  winner_mode: RewardWinnerMode;
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

export type FinanceEntryType = 'income' | 'expense' | 'future_income';

export interface AdminFinanceEntry {
  id: string;
  entry_type: FinanceEntryType;
  amount: number;
  description: string;
  entry_date: string;
  admin_user_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type ScannerStatus = 'active' | 'maintenance' | 'retired';

export interface Scanner {
  id: string;
  name: string;
  code: string;
  status: ScannerStatus;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type BookingPackage = 'independent' | 'full' | 'offline' | 'organizations';

export interface ScannerBooking {
  id: string;
  /** Null = booking without a physical scanner (calendar / game only). */
  scanner_id: string | null;
  start_date: string;
  end_date: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  /** Linked game event. */
  event_id: string | null;
  /** Commercial package for this booking. */
  booking_package: BookingPackage | null;
  /** Amount charged (may differ from list price). */
  amount: number | null;
  /** Amount received so far. Remainder is debt. */
  amount_paid: number | null;
  /** True when any payment was recorded (amount_paid > 0). */
  is_paid: boolean;
  /** Linked income row for the paid portion. */
  finance_entry_id: string | null;
  /** Linked future_income row for unpaid remainder (debt), if any. */
  debt_finance_entry_id: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const WIZARD_STEPS: { id: WizardStepId; label: string; step: number }[] = [
  { id: 'details', label: 'פרטי הפעילות', step: 1 },
  { id: 'groups', label: 'חלוקה לקבוצות', step: 2 },
  { id: 'participants', label: 'מי משתתף?', step: 3 },
  { id: 'tasks', label: 'צבירת נקודות', step: 4 },
  { id: 'rewards', label: 'פרסים', step: 5 },
  { id: 'review', label: 'מוכנים לצאת לדרך?', step: 6 },
];
