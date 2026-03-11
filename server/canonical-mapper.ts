/**
 * canonical-mapper.ts
 *
 * Modular source-to-canonical mapping service.
 *
 * Architectural intent:
 * - Staged payloads are the raw ingestion layer (raw_staged_payloads)
 * - Source profiles + mapping configs define source understanding
 * - Canonical tables are the normalized integration layer
 * - Future analytics modules build on canonical data, not raw source shapes
 *
 * This mapper is sourceType-aware and connector-agnostic where possible.
 */

import { extractArray } from "./sync-normalizer";
import type { SourceMappingConfig } from "@shared/schema";

// ── Validation reason codes ──

export type ValidationReason =
  | "missing_identifier"
  | "missing_name"
  | "missing_date"
  | "missing_status"
  | "unresolved_person_link"
  | "weak_identity_match"
  | "unsupported_shape"
  | "duplicate_source_record"
  | "insufficient_fields_for_promotion"
  | "empty_record";

export type CompletenessLevel = "full" | "partial" | "identifier_only";
export type MappingConfidence = "low" | "medium" | "high";
export type ValidationStatus = "candidate" | "promoted" | "blocked";

// ── Canonical candidate types ──

export interface CanonicalPersonCandidate {
  sourceType: string;
  sourceConnectionId: string;
  sourceRecordId: string;
  sourceEndpoint: string;
  gymId: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  externalPersonId: string | null;
  completenessLevel: CompletenessLevel;
  mappingConfidence: MappingConfidence;
  validationStatus: ValidationStatus;
  validationReasons: ValidationReason[];
}

export interface CanonicalMembershipCandidate {
  sourceType: string;
  sourceConnectionId: string;
  sourceRecordId: string;
  sourceEndpoint: string;
  gymId: string;
  canonicalPersonId: string | null;
  membershipName: string | null;
  membershipStatus: string | null;
  startDate: string | null;
  endDate: string | null;
  billingAmount: string | null;
  billingPeriod: string | null;
  externalMembershipId: string | null;
  completenessLevel: CompletenessLevel;
  mappingConfidence: MappingConfidence;
  validationStatus: ValidationStatus;
  validationReasons: ValidationReason[];
}

export interface CanonicalAttendanceCandidate {
  sourceType: string;
  sourceConnectionId: string;
  sourceRecordId: string;
  sourceEndpoint: string;
  gymId: string;
  canonicalPersonId: string | null;
  attendanceDate: string | null;
  className: string | null;
  programName: string | null;
  locationName: string | null;
  attendanceStatus: string | null;
  externalAttendanceId: string | null;
  completenessLevel: CompletenessLevel;
  mappingConfidence: MappingConfidence;
  validationStatus: ValidationStatus;
  validationReasons: ValidationReason[];
}

// ── Helpers ──

function pick(record: Record<string, any>, field: string | null | undefined): string | null {
  if (!field) return null;
  const val = record[field];
  if (val === null || val === undefined || val === "") return null;
  return String(val).trim() || null;
}

function deriveCompleteness(fields: { id: boolean; name: boolean; extras: number }): CompletenessLevel {
  if (fields.id && fields.name && fields.extras >= 2) return "full";
  if (fields.id && (fields.name || fields.extras >= 1)) return "partial";
  return "identifier_only";
}

function deriveConfidence(completeness: CompletenessLevel, reasons: ValidationReason[]): MappingConfidence {
  const hasCriticalMissing = reasons.includes("missing_identifier") || reasons.includes("unsupported_shape") || reasons.includes("empty_record");
  if (hasCriticalMissing) return "low";
  if (completeness === "full") return "high";
  if (completeness === "partial") return "medium";
  return "low";
}

// ── Promotion rules ──

/**
 * A person can be promoted if:
 * - There is at least one stable identifier (external id or email)
 * - The record is not missing both name fields entirely
 */
export function evaluatePersonPromotion(candidate: CanonicalPersonCandidate): ValidationStatus {
  const hasStableId = !!(candidate.externalPersonId || candidate.email || candidate.sourceRecordId);
  const hasSomeName = !!(candidate.firstName || candidate.lastName || candidate.fullName);

  if (!hasStableId) return "blocked";
  if (!hasSomeName) return "candidate";
  return "promoted";
}

/**
 * A membership can be promoted if:
 * - There is a reliable membership identifier
 * - There is enough date or status context to be useful
 * - Even without an optional billing amount, it can still promote
 */
export function evaluateMembershipPromotion(candidate: CanonicalMembershipCandidate): ValidationStatus {
  const hasId = !!(candidate.externalMembershipId || candidate.sourceRecordId);
  const hasDateContext = !!(candidate.startDate || candidate.endDate);
  const hasStatusContext = !!candidate.membershipStatus;

  if (!hasId) return "blocked";
  if (!hasDateContext && !hasStatusContext) return "candidate";
  return "promoted";
}

/**
 * Attendance can be promoted if:
 * - It has a valid attendance date
 * - It has either a person link or a stable external attendance id
 */
export function evaluateAttendancePromotion(candidate: CanonicalAttendanceCandidate): ValidationStatus {
  const hasDate = !!candidate.attendanceDate;
  const hasPersonRef = !!(candidate.canonicalPersonId || candidate.externalAttendanceId || candidate.sourceRecordId);

  if (!hasDate) return "blocked";
  if (!hasPersonRef) return "candidate";
  return "promoted";
}

// ── Mapper: People ──

export function mapPersonRecord(
  record: Record<string, any>,
  config: SourceMappingConfig,
  gymId: string,
  connectionId: string,
  endpoint: string,
  sourceType = "wodify",
): CanonicalPersonCandidate {
  const reasons: ValidationReason[] = [];

  const sourceRecordId = pick(record, config.personIdentifierField) || pick(record, "id") || pick(record, "client_id") || null;
  const firstName = pick(record, config.personFirstNameField) || pick(record, "first_name") || pick(record, "firstName") || null;
  const lastName = pick(record, config.personLastNameField) || pick(record, "last_name") || pick(record, "lastName") || null;
  const email = pick(record, config.personEmailField) || pick(record, "email") || pick(record, "email_address") || null;
  const phone = pick(record, config.personPhoneField) || pick(record, "phone") || pick(record, "phone_number") || null;
  const externalPersonId = pick(record, config.personExternalIdField) || pick(record, "external_id") || pick(record, "person_id") || sourceRecordId;

  if (!sourceRecordId) reasons.push("missing_identifier");
  if (!firstName && !lastName) reasons.push("missing_name");

  const hasId = !!(sourceRecordId || externalPersonId);
  const hasName = !!(firstName || lastName);
  const extraCount = [email, phone].filter(Boolean).length;

  const completenessLevel = deriveCompleteness({ id: hasId, name: hasName, extras: extraCount });
  const mappingConfidence = deriveConfidence(completenessLevel, reasons);

  const fullName = firstName && lastName ? `${firstName} ${lastName}`.trim()
    : firstName || lastName || pick(record, "name") || pick(record, "full_name") || null;

  const candidate: CanonicalPersonCandidate = {
    sourceType,
    sourceConnectionId: connectionId,
    sourceRecordId: sourceRecordId || `synthetic_${JSON.stringify(record).slice(0, 32)}`,
    sourceEndpoint: endpoint,
    gymId,
    firstName,
    lastName,
    fullName,
    email,
    phone,
    externalPersonId,
    completenessLevel,
    mappingConfidence,
    validationStatus: "candidate",
    validationReasons: reasons,
  };

  candidate.validationStatus = evaluatePersonPromotion(candidate);
  return candidate;
}

// ── Mapper: Memberships ──

export function mapMembershipRecord(
  record: Record<string, any>,
  config: SourceMappingConfig,
  gymId: string,
  connectionId: string,
  endpoint: string,
  sourceType = "wodify",
  personIdLookup: Map<string, string> = new Map(),
): CanonicalMembershipCandidate {
  const reasons: ValidationReason[] = [];

  const sourceRecordId = pick(record, config.membershipIdentifierField) || pick(record, "id") || pick(record, "membership_id") || null;
  const externalMembershipId = pick(record, "membership_id") || pick(record, "external_id") || sourceRecordId;
  const membershipName = pick(record, config.membershipNameField) || pick(record, "membership_name") || pick(record, "name") || pick(record, "plan_name") || null;
  const membershipStatus = pick(record, config.membershipStatusField) || pick(record, "status") || pick(record, "membership_status") || null;
  const startDate = pick(record, config.membershipStartDateField) || pick(record, "start_date") || pick(record, "start") || null;
  const endDate = pick(record, config.membershipEndDateField) || pick(record, "end_date") || pick(record, "end") || pick(record, "expiration_date") || null;
  const billingAmount = pick(record, config.membershipBillingAmountField) || pick(record, "billing_amount") || pick(record, "amount") || pick(record, "price") || null;
  const billingPeriod = pick(record, config.membershipBillingPeriodField) || pick(record, "billing_period") || pick(record, "billing_frequency") || null;

  const personLinkRaw = pick(record, config.membershipPersonLinkField) || pick(record, "client_id") || pick(record, "person_id") || null;
  const canonicalPersonId = personLinkRaw ? (personIdLookup.get(personLinkRaw) || null) : null;

  if (!sourceRecordId) reasons.push("missing_identifier");
  if (!startDate && !endDate) reasons.push("missing_date");
  if (!membershipStatus) reasons.push("missing_status");
  if (personLinkRaw && !canonicalPersonId) reasons.push("unresolved_person_link");

  const hasId = !!(sourceRecordId || externalMembershipId);
  const hasDateContext = !!(startDate || endDate);
  const extraCount = [membershipStatus, billingAmount, membershipName].filter(Boolean).length;

  const completenessLevel = deriveCompleteness({ id: hasId, name: !!membershipName, extras: extraCount + (hasDateContext ? 1 : 0) });
  const mappingConfidence = deriveConfidence(completenessLevel, reasons);

  const candidate: CanonicalMembershipCandidate = {
    sourceType,
    sourceConnectionId: connectionId,
    sourceRecordId: sourceRecordId || `synthetic_${JSON.stringify(record).slice(0, 32)}`,
    sourceEndpoint: endpoint,
    gymId,
    canonicalPersonId,
    membershipName,
    membershipStatus,
    startDate,
    endDate,
    billingAmount,
    billingPeriod,
    externalMembershipId,
    completenessLevel,
    mappingConfidence,
    validationStatus: "candidate",
    validationReasons: reasons,
  };

  candidate.validationStatus = evaluateMembershipPromotion(candidate);
  return candidate;
}

// ── Mapper: Attendance ──

export function mapAttendanceRecord(
  record: Record<string, any>,
  config: SourceMappingConfig,
  gymId: string,
  connectionId: string,
  endpoint: string,
  sourceType = "wodify",
  personIdLookup: Map<string, string> = new Map(),
): CanonicalAttendanceCandidate {
  const reasons: ValidationReason[] = [];

  const sourceRecordId = pick(record, config.attendanceIdentifierField) || pick(record, "id") || pick(record, "attendance_id") || null;
  const externalAttendanceId = pick(record, "attendance_id") || pick(record, "external_id") || sourceRecordId;
  const attendanceDate = pick(record, config.attendanceDateField) || pick(record, "date") || pick(record, "attendance_date") || pick(record, "class_date") || null;
  const className = pick(record, config.attendanceClassNameField) || pick(record, "class_name") || pick(record, "class") || pick(record, "workout_name") || null;
  const programName = pick(record, config.attendanceProgramField) || pick(record, "program") || pick(record, "program_name") || null;
  const locationName = pick(record, config.attendanceLocationField) || pick(record, "location") || pick(record, "location_name") || null;
  const attendanceStatus = pick(record, config.attendanceStatusField) || pick(record, "status") || pick(record, "attendance_status") || null;

  const personLinkRaw = pick(record, config.attendancePersonLinkField) || pick(record, "client_id") || pick(record, "person_id") || null;
  const canonicalPersonId = personLinkRaw ? (personIdLookup.get(personLinkRaw) || null) : null;

  if (!attendanceDate) reasons.push("missing_date");
  if (!sourceRecordId) reasons.push("missing_identifier");
  if (personLinkRaw && !canonicalPersonId) reasons.push("unresolved_person_link");

  const hasId = !!(sourceRecordId || externalAttendanceId);
  const hasDateContext = !!attendanceDate;
  const extraCount = [className, programName, locationName, attendanceStatus].filter(Boolean).length;

  const completenessLevel = deriveCompleteness({ id: hasId, name: hasDateContext, extras: extraCount });
  const mappingConfidence = deriveConfidence(completenessLevel, reasons);

  const candidate: CanonicalAttendanceCandidate = {
    sourceType,
    sourceConnectionId: connectionId,
    sourceRecordId: sourceRecordId || `synthetic_${JSON.stringify(record).slice(0, 32)}`,
    sourceEndpoint: endpoint,
    gymId,
    canonicalPersonId,
    attendanceDate,
    className,
    programName,
    locationName,
    attendanceStatus,
    externalAttendanceId,
    completenessLevel,
    mappingConfidence,
    validationStatus: "candidate",
    validationReasons: reasons,
  };

  candidate.validationStatus = evaluateAttendancePromotion(candidate);
  return candidate;
}

// ── Auto-generate mapping config from source profile ──

export interface SourceProfileSummary {
  discoveredEndpoints: string[];
  endpointSummaries: Array<{
    endpoint: string;
    sampleFieldNames: string[];
  }>;
  discoveredIdentifierCandidates: string[];
  discoveredDateFields: string[];
  discoveredRevenueFields: string[];
  discoveredStatusFields: string[];
}

function bestMatch(candidates: string[], options: string[]): string | null {
  for (const opt of options) {
    if (candidates.some((c) => c.toLowerCase() === opt.toLowerCase())) return opt;
  }
  return null;
}

export function generateMappingConfigFromProfile(
  gymId: string,
  connectionId: string,
  sourceType = "wodify",
  profile: SourceProfileSummary,
  profileId?: string,
): Omit<import("@shared/schema").InsertSourceMappingConfig, never> {
  const allFields = profile.endpointSummaries.flatMap((s) => s.sampleFieldNames);
  const clientFields = profile.endpointSummaries.find((s) => s.endpoint === "/clients")?.sampleFieldNames || allFields;
  const membershipFields = profile.endpointSummaries.find((s) => s.endpoint === "/memberships")?.sampleFieldNames || allFields;
  const attendanceFields = profile.endpointSummaries.find((s) => s.endpoint.includes("attendance") || s.endpoint.includes("reservation"))?.sampleFieldNames || allFields;

  const hasEndpoint = (ep: string) => profile.discoveredEndpoints.some((d) => ep.includes(d) || d.includes(ep));

  return {
    gymId,
    connectionId,
    sourceType,
    // Person mapping
    personEndpoint: hasEndpoint("clients") ? "/clients" : null,
    personIdentifierField: bestMatch(clientFields, ["id", "client_id", "external_id", "person_id"]),
    personFirstNameField: bestMatch(clientFields, ["first_name", "firstName", "given_name", "name"]),
    personLastNameField: bestMatch(clientFields, ["last_name", "lastName", "surname", "family_name"]),
    personEmailField: bestMatch(clientFields, ["email", "email_address", "primary_email"]),
    personPhoneField: bestMatch(clientFields, ["phone", "phone_number", "mobile", "cell"]),
    personExternalIdField: bestMatch(clientFields, ["external_id", "client_id", "person_id", "id"]),
    // Membership mapping
    membershipEndpoint: hasEndpoint("memberships") ? "/memberships" : null,
    membershipIdentifierField: bestMatch(membershipFields, ["id", "membership_id", "external_id"]),
    membershipNameField: bestMatch(membershipFields, ["membership_name", "name", "plan_name", "program_name"]),
    membershipStatusField: bestMatch(membershipFields, ["status", "membership_status", "state", "active"]),
    membershipStartDateField: bestMatch(membershipFields, ["start_date", "start", "begin_date", "created_date"]),
    membershipEndDateField: bestMatch(membershipFields, ["end_date", "end", "expiration_date", "termination_date"]),
    membershipBillingAmountField: bestMatch(membershipFields, ["billing_amount", "amount", "price", "rate", "cost"]),
    membershipBillingPeriodField: bestMatch(membershipFields, ["billing_period", "billing_frequency", "frequency", "period"]),
    membershipPersonLinkField: bestMatch(membershipFields, ["client_id", "person_id", "member_id", "user_id"]),
    // Attendance mapping
    attendanceEndpoint: hasEndpoint("attendance") ? "/attendance" : (hasEndpoint("reservations") ? "/reservations" : null),
    attendanceIdentifierField: bestMatch(attendanceFields, ["id", "attendance_id", "reservation_id", "visit_id"]),
    attendanceDateField: bestMatch(attendanceFields, ["date", "attendance_date", "class_date", "visit_date", "reservation_date"]),
    attendanceClassNameField: bestMatch(attendanceFields, ["class_name", "class", "workout_name", "wod_name"]),
    attendanceProgramField: bestMatch(attendanceFields, ["program", "program_name", "course"]),
    attendanceLocationField: bestMatch(attendanceFields, ["location", "location_name", "gym_name"]),
    attendanceStatusField: bestMatch(attendanceFields, ["status", "attendance_status", "reservation_status"]),
    attendancePersonLinkField: bestMatch(attendanceFields, ["client_id", "person_id", "member_id", "user_id"]),
    // Metadata
    autoGenerated: true,
    generatedFromProfileId: profileId || null,
  };
}
