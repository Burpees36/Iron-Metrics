import { parseCSVLine, parseDate, computeFileHash } from "./csv-parser";

export { computeFileHash, parseDate };

export interface LeadColumnMapping {
  createdDate: number;
  source: number;
  stage: number;
  name: number;
  email: number;
  phone: number;
  coach: number;
  saleDate: number;
  salePrice: number;
  consultDate: number;
  lostReason: number;
  notes: number;
}

export interface ParsedLead {
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  stage: string;
  coachId: string | null;
  createdDate: string;
  consultDate: string | null;
  saleDate: string | null;
  salePrice: string | null;
  lostReason: string | null;
  notes: string | null;
}

export interface LeadRowError {
  row: number;
  field: string;
  value: string;
  message: string;
}

export interface LeadPreviewResult {
  headers: string[];
  sampleRows: string[][];
  totalRows: number;
  detectedMapping: LeadColumnMapping;
  mappingConfidence: Record<string, "high" | "medium" | "low" | "unmapped">;
  validationSummary: {
    validRows: number;
    errorRows: number;
    warningRows: number;
    errors: LeadRowError[];
    warnings: LeadRowError[];
  };
  parsedPreview: ParsedLead[];
  uniqueStages: string[];
  detectedStageMapping: Record<string, string>;
}

export interface LeadImportResult {
  leads: ParsedLead[];
  errors: LeadRowError[];
  totalRows: number;
  validRows: number;
  errorRows: number;
}

const LEAD_HEADER_SYNONYMS: Record<string, string[]> = {
  createdDate: ["created", "lead_date", "date", "created_at", "date_added", "inquiry_date", "created_date", "lead date", "date added", "inquiry date", "entry_date", "first_contact", "contact_date"],
  source: ["source", "lead_source", "referral", "channel", "how_heard", "marketing_source", "lead source", "how heard", "marketing source", "referral_source", "origin", "medium", "campaign"],
  stage: ["stage", "status", "outcome", "result", "disposition", "pipeline_stage", "pipeline stage", "lead_status", "lead status", "funnel_stage", "funnel stage", "step"],
  name: ["name", "lead_name", "contact", "prospect", "first_name", "full_name", "client", "lead name", "full name", "first name", "contact_name", "client_name", "person"],
  email: ["email", "email_address", "e-mail", "email address", "contact_email"],
  phone: ["phone", "phone_number", "mobile", "cell", "telephone", "phone number", "cell_phone", "mobile_phone"],
  coach: ["coach", "assigned_to", "sales_rep", "consultant", "trainer", "staff", "assigned to", "sales rep", "salesperson", "closer", "coach_name"],
  saleDate: ["sale_date", "close_date", "won_date", "signup_date", "join_date", "membership_date", "sale date", "close date", "won date", "signup date", "join date", "enrollment_date"],
  salePrice: ["price", "sale_price", "amount", "revenue", "membership_price", "monthly_rate", "rate", "sale price", "monthly rate", "membership price", "dues", "fee", "monthly_amount"],
  consultDate: ["consult_date", "appointment", "meeting_date", "booked_date", "intro_date", "consult date", "meeting date", "booked date", "intro date", "appointment_date", "nsi_date", "trial_date"],
  lostReason: ["lost_reason", "reason", "drop_reason", "cancel_reason", "decline_reason", "lost reason", "drop reason", "cancel reason", "loss_reason", "why_lost"],
  notes: ["notes", "comments", "description", "details", "memo", "remarks"],
};

const STAGE_MAP: Record<string, string[]> = {
  new: ["new", "inquiry", "lead", "prospect", "interested", "cold", "warm", "hot", "open", "pending", "fresh", "incoming"],
  booked: ["booked", "scheduled", "appointment", "nsi", "intro", "consultation", "set", "trial", "booked intro", "free trial", "consultation booked", "apt", "appt", "consult"],
  showed: ["showed", "attended", "visited", "came in", "showed up", "completed", "present", "showed_up", "no-sale", "no sale yet", "follow up", "followup", "follow-up"],
  won: ["won", "closed", "signed", "converted", "member", "joined", "sale", "enrolled", "active", "sold", "closed won", "signup", "signed up", "new member", "membership"],
  lost: ["lost", "dead", "no sale", "declined", "rejected", "not interested", "cancelled", "dropped", "no show", "ghost", "closed lost", "no-show", "noshow", "gone", "cold dead", "unresponsive"],
};

function parseLeadHeaders(csvText: string): { headers: string[]; lines: string[] } {
  const lines = csvText.trim().split("\n");
  if (lines.length < 1) throw new Error("File is empty");
  const headerLine = lines[0].replace(/\r/g, "");
  const headers = parseCSVLine(headerLine);
  return { headers, lines };
}

export function detectLeadMapping(headers: string[]): {
  mapping: LeadColumnMapping;
  confidence: Record<string, "high" | "medium" | "low" | "unmapped">;
} {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  const mapping: LeadColumnMapping = {
    createdDate: -1, source: -1, stage: -1, name: -1, email: -1,
    phone: -1, coach: -1, saleDate: -1, salePrice: -1,
    consultDate: -1, lostReason: -1, notes: -1,
  };
  const confidence: Record<string, "high" | "medium" | "low" | "unmapped"> = {};
  const usedIndices = new Set<number>();

  for (const [field, synonyms] of Object.entries(LEAD_HEADER_SYNONYMS)) {
    let bestIdx = -1;
    let bestConf: "high" | "medium" | "low" = "low";

    for (const syn of synonyms) {
      const idx = lowerHeaders.indexOf(syn);
      if (idx >= 0 && !usedIndices.has(idx)) {
        bestIdx = idx;
        bestConf = syn === synonyms[0] ? "high" : "medium";
        break;
      }
    }

    if (bestIdx === -1) {
      for (let i = 0; i < lowerHeaders.length; i++) {
        if (usedIndices.has(i)) continue;
        for (const syn of synonyms) {
          if (lowerHeaders[i].includes(syn) || syn.includes(lowerHeaders[i])) {
            bestIdx = i;
            bestConf = "low";
            break;
          }
        }
        if (bestIdx >= 0) break;
      }
    }

    (mapping as any)[field] = bestIdx;
    confidence[field] = bestIdx >= 0 ? bestConf : "unmapped";
    if (bestIdx >= 0) usedIndices.add(bestIdx);
  }

  return { mapping, confidence };
}

export function normalizeLeadStage(raw: string, customMapping?: Record<string, string>): string {
  if (!raw) return "new";
  const lower = raw.toLowerCase().trim();

  if (customMapping && customMapping[lower]) {
    return customMapping[lower];
  }
  if (customMapping && customMapping[raw]) {
    return customMapping[raw];
  }

  for (const [stage, aliases] of Object.entries(STAGE_MAP)) {
    if (aliases.includes(lower)) return stage;
    for (const alias of aliases) {
      if (lower.includes(alias) || alias.includes(lower)) return stage;
    }
  }
  return "new";
}

export function detectStageMapping(stageValues: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const raw of stageValues) {
    mapping[raw] = normalizeLeadStage(raw);
  }
  return mapping;
}

function normalizeSource(raw: string): string {
  if (!raw) return "Unknown";
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  const sourceMap: Record<string, string> = {
    fb: "Facebook", facebook: "Facebook", "facebook ad": "Facebook", "fb ad": "Facebook", "facebook ads": "Facebook",
    ig: "Instagram", instagram: "Instagram", "instagram ad": "Instagram", "ig ad": "Instagram",
    google: "Google", "google ad": "Google", "google ads": "Google", "google search": "Google", sem: "Google", ppc: "Google",
    referral: "Referral", "word of mouth": "Referral", wom: "Referral", "friend referral": "Referral", "member referral": "Referral",
    "walk-in": "Walk-in", "walk in": "Walk-in", walkin: "Walk-in", "drop in": "Walk-in", "drop-in": "Walk-in",
    website: "Website", web: "Website", online: "Website", "web form": "Website", "website form": "Website",
    yelp: "Yelp",
    "class pass": "ClassPass", classpass: "ClassPass",
  };

  return sourceMap[lower] || trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function sanitizeText(s: string): string {
  return s.replace(/[<>{}]/g, "").replace(/\s+/g, " ").trim();
}

function sanitizeEmail(s: string): string | null {
  const cleaned = s.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(cleaned) ? cleaned : null;
}

function parsePrice(s: string): string | null {
  if (!s) return null;
  const cleaned = s.replace(/[$,\s€£]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  if (num < 0) return null;
  return num.toFixed(2);
}

function normalizeAndValidateLeadRow(
  cols: string[],
  mapping: LeadColumnMapping,
  rowNum: number,
  stageMapping?: Record<string, string>
): { lead: ParsedLead | null; errors: LeadRowError[]; warnings: LeadRowError[] } {
  const errors: LeadRowError[] = [];
  const warnings: LeadRowError[] = [];

  const rawCreatedDate = mapping.createdDate >= 0 ? (cols[mapping.createdDate] || "").trim() : "";
  const rawSource = mapping.source >= 0 ? (cols[mapping.source] || "").trim() : "";
  const rawStage = mapping.stage >= 0 ? (cols[mapping.stage] || "").trim() : "";
  const rawName = mapping.name >= 0 ? (cols[mapping.name] || "").trim() : "";
  const rawEmail = mapping.email >= 0 ? (cols[mapping.email] || "").trim() : "";
  const rawPhone = mapping.phone >= 0 ? (cols[mapping.phone] || "").trim() : "";
  const rawCoach = mapping.coach >= 0 ? (cols[mapping.coach] || "").trim() : "";
  const rawSaleDate = mapping.saleDate >= 0 ? (cols[mapping.saleDate] || "").trim() : "";
  const rawSalePrice = mapping.salePrice >= 0 ? (cols[mapping.salePrice] || "").trim() : "";
  const rawConsultDate = mapping.consultDate >= 0 ? (cols[mapping.consultDate] || "").trim() : "";
  const rawLostReason = mapping.lostReason >= 0 ? (cols[mapping.lostReason] || "").trim() : "";
  const rawNotes = mapping.notes >= 0 ? (cols[mapping.notes] || "").trim() : "";

  const createdDate = parseDate(rawCreatedDate);
  if (!createdDate) {
    errors.push({ row: rowNum, field: "createdDate", value: rawCreatedDate, message: rawCreatedDate ? `Could not parse date "${rawCreatedDate}"` : "Created date is required" });
  }

  const source = normalizeSource(rawSource);
  if (!rawSource) {
    warnings.push({ row: rowNum, field: "source", value: "", message: "No source specified, defaulting to Unknown" });
  }

  const stage = normalizeLeadStage(rawStage, stageMapping);
  if (!rawStage) {
    warnings.push({ row: rowNum, field: "stage", value: "", message: "No stage specified, defaulting to new" });
  }

  const name = rawName ? sanitizeText(rawName) : null;
  const email = rawEmail ? sanitizeEmail(rawEmail) : null;
  if (rawEmail && !email) {
    warnings.push({ row: rowNum, field: "email", value: rawEmail, message: `Invalid email format "${rawEmail}"` });
  }

  const phone = rawPhone ? sanitizeText(rawPhone) : null;
  const coachId = rawCoach ? sanitizeText(rawCoach) : null;

  let consultDate: string | null = null;
  if (rawConsultDate) {
    consultDate = parseDate(rawConsultDate);
    if (!consultDate) {
      warnings.push({ row: rowNum, field: "consultDate", value: rawConsultDate, message: `Could not parse consult date "${rawConsultDate}"` });
    }
  }

  let saleDate: string | null = null;
  if (rawSaleDate) {
    saleDate = parseDate(rawSaleDate);
    if (!saleDate) {
      warnings.push({ row: rowNum, field: "saleDate", value: rawSaleDate, message: `Could not parse sale date "${rawSaleDate}"` });
    }
  }

  let salePrice: string | null = null;
  if (rawSalePrice) {
    salePrice = parsePrice(rawSalePrice);
    if (salePrice === null) {
      warnings.push({ row: rowNum, field: "salePrice", value: rawSalePrice, message: `Invalid sale price "${rawSalePrice}"` });
    }
  }

  if (stage === "won" && !salePrice && rawSalePrice) {
    warnings.push({ row: rowNum, field: "salePrice", value: rawSalePrice, message: "Won lead has invalid sale price" });
  }

  const lostReason = rawLostReason ? sanitizeText(rawLostReason).toLowerCase() : null;
  const notes = rawNotes ? sanitizeText(rawNotes) : null;

  if (errors.length > 0) {
    return { lead: null, errors, warnings };
  }

  return {
    lead: {
      name,
      email,
      phone,
      source,
      stage,
      coachId,
      createdDate: createdDate!,
      consultDate,
      saleDate,
      salePrice,
      lostReason,
      notes,
    },
    errors: [],
    warnings,
  };
}

export function previewLeadCsv(
  csvText: string,
  customMapping?: Partial<LeadColumnMapping>,
  stageMapping?: Record<string, string>
): LeadPreviewResult {
  const { headers, lines } = parseLeadHeaders(csvText);
  const { mapping: detectedMapping, confidence } = detectLeadMapping(headers);
  const finalMapping = { ...detectedMapping, ...customMapping };

  const dataLines = lines.slice(1).filter(l => l.replace(/\r/g, "").trim() !== "");
  const totalRows = dataLines.length;

  const sampleRows: string[][] = [];
  const allErrors: LeadRowError[] = [];
  const allWarnings: LeadRowError[] = [];
  const parsedPreview: ParsedLead[] = [];
  const uniqueStageValues = new Set<string>();
  let validRows = 0;
  let errorRows = 0;
  let warningRows = 0;

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].replace(/\r/g, "");
    const cols = parseCSVLine(line);

    if (i < 20) sampleRows.push(cols);

    if (finalMapping.stage >= 0 && cols[finalMapping.stage]) {
      uniqueStageValues.add(cols[finalMapping.stage].trim());
    }

    const { lead, errors, warnings } = normalizeAndValidateLeadRow(cols, finalMapping, i + 2, stageMapping);
    if (errors.length > 0) {
      errorRows++;
      if (allErrors.length < 200) allErrors.push(...errors);
    } else {
      validRows++;
      if (i < 20 && lead) parsedPreview.push(lead);
    }
    if (warnings.length > 0) {
      warningRows++;
      if (allWarnings.length < 100) allWarnings.push(...warnings);
    }
  }

  const uniqueStages = [...uniqueStageValues];
  const detectedStageMap = detectStageMapping(uniqueStages);

  return {
    headers,
    sampleRows,
    totalRows,
    detectedMapping: finalMapping,
    mappingConfidence: confidence,
    validationSummary: {
      validRows,
      errorRows,
      warningRows,
      errors: allErrors,
      warnings: allWarnings,
    },
    parsedPreview,
    uniqueStages,
    detectedStageMapping: detectedStageMap,
  };
}

export function parseAllLeadRows(
  csvText: string,
  mapping: LeadColumnMapping,
  stageMapping?: Record<string, string>
): LeadImportResult {
  const lines = csvText.trim().split("\n");
  const dataLines = lines.slice(1).filter(l => l.replace(/\r/g, "").trim() !== "");

  const leads: ParsedLead[] = [];
  const errors: LeadRowError[] = [];
  let validRows = 0;
  let errorRows = 0;

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].replace(/\r/g, "");
    const cols = parseCSVLine(line);
    const { lead, errors: rowErrors } = normalizeAndValidateLeadRow(cols, mapping, i + 2, stageMapping);

    if (rowErrors.length > 0) {
      errorRows++;
      errors.push(...rowErrors);
    } else if (lead) {
      validRows++;
      leads.push(lead);
    }
  }

  return { leads, errors, totalRows: dataLines.length, validRows, errorRows };
}
