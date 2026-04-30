/**
 * Shared types for the Caregiver app's database schema and Supabase
 * joined-query result shapes.
 *
 * Supabase's TypeScript inference often returns nested relations as either
 * `T | null` or `T[]` depending on the relationship. To keep our pages
 * straightforward, we explicitly cast query results to typed shapes defined
 * here, instead of leaning on `as any`.
 */

export type Role = "admin" | "client" | "caregiver" | "family";
export type AssignmentStatus = "pending" | "accepted" | "declined";

export type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: Role;
  is_active: boolean;
  organization_id: string;
};

export type ClientRow = {
  id: string;
  full_name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_meters: number;
  organization_id: string;
};

export type ShiftTypeRow = {
  id: string;
  name: string;
  color: string;
  organization_id: string;
};

export type ShiftRow = {
  id: string;
  organization_id: string;
  client_id: string;
  caregiver_id: string | null;
  shift_type_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  bonus_amount: number | null;
  bonus_reason: string | null;
  notes: string | null;
  assignment_status: AssignmentStatus | null;
};

export type CheckInRow = {
  id: string;
  shift_id: string;
  caregiver_id: string;
  check_in_time: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_in_within_geofence: boolean | null;
  check_out_time: string | null;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
  check_out_within_geofence: boolean | null;
  total_minutes: number | null;
  flagged_outside_geofence: boolean | null;
  flag_reason: string | null;
};

export type ShiftTodoRow = {
  id: string;
  shift_id: string;
  template_id: string | null;
  task_name: string;
  description: string | null;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  sort_order: number;
};

/**
 * A single shift joined with its related rows. We always select these joins
 * the same way so this shape captures the common result.
 *
 * Supabase returns nested relations as objects when there's a single FK to
 * a parent (many-to-one), or as arrays when there's a parent with many children
 * (one-to-many). We use explicit names matching how we select.
 *
 * - `profiles:caregiver_id` → single object (or null) because shifts.caregiver_id is one FK
 * - `clients` → single object (or null), single FK
 * - `shift_types` → single object (or null), single FK
 * - `check_ins` → array (one-to-many in schema; but we have unique(shift_id) so it's 0 or 1)
 * - `shift_todos` → array
 */
export type ShiftWithRelations = ShiftRow & {
  profiles: Pick<ProfileRow, "full_name"> | null;
  clients: Pick<
    ClientRow,
    | "full_name"
    | "address"
    | "latitude"
    | "longitude"
    | "geofence_radius_meters"
  > | null;
  shift_types: Pick<ShiftTypeRow, "name" | "color"> | null;
  check_ins: Array<
    Pick<
      CheckInRow,
      | "id"
      | "check_in_time"
      | "check_out_time"
      | "total_minutes"
      | "flagged_outside_geofence"
      | "flag_reason"
    >
  >;
  shift_todos: Array<
    Pick<ShiftTodoRow, "id" | "task_name" | "is_completed">
  >;
};
