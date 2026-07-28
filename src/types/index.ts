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
export type WizardStepId = 'details' | 'groups' | 'participants' | 'tasks' | 'rewards' | 'sms' | 'cards' | 'review';
export type GroupType = 'none' | 'custom';

export interface WizardState {
  details: StepStatus;
  groups: StepStatus;
  participants: StepStatus;
  tasks: StepStatus;
  rewards: StepStatus;
  /** Only ever seen by games with the `sms_notifications` flag. */
  sms: StepStatus;
  cards: StepStatus;
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

/**
 * Which deck gets printed, chosen in the wizard's cards step and kept on the
 * event (079). The scanner reads both kinds of card regardless, so this governs
 * only how cards are laid out for printing.
 * - `combined`: one QR holds participant + action - a single scan scores.
 * - `split`: separate participant and action QRs - participant first, then action.
 */
export type ScanMode = 'combined' | 'split';

/**
 * Card barcode symbology, chosen per event by an admin.
 * - `qr`: two-dimensional QR (the default; carries JSON).
 * - `code128`: one-dimensional linear barcode (carries a compact string).
 * The scanner reads either kind of card; this governs only how cards print.
 */
export type BarcodeType = 'qr' | 'code128';

export interface Event {
  id: string;
  owner_admin_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  status: EventStatus;
  plan: UserPlan;
  barcode_type: BarcodeType;
  /** null until the cards step is answered; printing falls back to 'combined'. */
  scan_mode: ScanMode | null;
  /**
   * The text this game sends after a scan, as its owner wrote it on the SMS
   * step. null means nobody changed it and DEFAULT_SMS_TEMPLATE is in force -
   * as it is on an older database where migration 082 has not run, where this
   * is undefined. See src/lib/smsTemplate.ts.
   */
  sms_template?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Participant {
  id: string;
  event_id: string;
  external_id: string;
  name: string;
  /**
   * E.164 (`+972501234567`), collected only by games with the
   * `sms_notifications` flag. null everywhere else - and on an older database
   * where migration 081 has not run, undefined. See src/lib/phone.ts.
   */
  phone?: string | null;
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
  /** True = a hold that isn't closed yet. Another booking may take its
   *  scanner, which drops this one to scanner_id = null. */
  is_tentative: boolean;
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
  /** Admin whose account the payment lands in - mirrored onto the finance rows. */
  collected_by: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// The numbers are the wizard's own, not a count of what any one run shows: a
// template skips two of these and a game without the sms_notifications flag
// skips the SMS step, so the numbering has gaps in it. What the operator sees
// is a running 1..n, counted over the visible steps in WizardProgress.
export const WIZARD_STEPS: { id: WizardStepId; label: string; step: number }[] = [
  { id: 'details', label: 'פרטי הפעילות', step: 1 },
  { id: 'groups', label: 'חלוקה לקבוצות', step: 2 },
  { id: 'participants', label: 'מי משתתף?', step: 3 },
  { id: 'tasks', label: 'צבירת נקודות', step: 4 },
  { id: 'rewards', label: 'פרסים', step: 5 },
  { id: 'sms', label: 'הודעות SMS', step: 6 },
  { id: 'cards', label: 'מוכנים להתחיל?', step: 7 },
  { id: 'review', label: 'מוכנים לצאת לדרך?', step: 8 },
];
