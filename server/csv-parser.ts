export interface ParsedMember {
  name: string;
  email: string | null;
  status: string;
  joinDate: string;
  cancelDate: string | null;
  monthlyRate: string;
}

export interface ColumnMapping {
  name: number;
  email: number;
  status: number;
  joinDate: number;
  cancelDate: number;
  monthlyRate: number;
}

export interface RowError {
  row: number;
  field: string;
  value: string;
  message: string;
}

export interface PreviewResult {
  headers: string[];
  sampleRows: string[][];
  totalRows: number;
  detectedMapping: ColumnMapping;
  mappingConfidence: Record<string, "high" | "medium" | "low" | "unmapped">;
  validationSummary: {
    validRows: number;
    errorRows: number;
    errors: RowError[];
  };
  parsedPreview: ParsedMember[];
}

export interface ImportResult {
  members: ParsedMember[];
  errors: RowError[];
  totalRows: number;
  validRows: number;
  errorRows: number;
}

const HEADER_SYNONYMS: Record<string, string[]> = {
  name: ["name", "member_name", "full_name", "member name", "fullname", "member", "first_name", "first name", "client_name", "client name", "athlete", "athlete_name"],
  email: ["email", "email_address", "e-mail", "email address", "e_mail", "member_email", "contact_email"],
  status: ["status", "membership_status", "member_status", "membership status", "member status", "active", "state", "membership_state"],
  joinDate: ["join_date", "joined", "start_date", "join date", "start date", "joined_date", "signup_date", "signup date", "sign_up_date", "created", "created_at", "created_date", "enrollment_date", "enrollment date", "date_joined", "member_since"],
  cancelDate: ["cancel_date", "cancelled", "end_date", "cancel date", "end date", "cancellation_date", "canceled_date", "cancelled_date", "termination_date", "cancel", "canceled", "left_date", "churn_date", "drop_date"],
  monthlyRate: ["monthly_rate", "rate", "price", "monthly_price", "monthly rate", "amount", "monthly_amount", "monthly amount", "membership_rate", "membership rate", "dues", "monthly_dues", "fee", "monthly_fee", "plan_price", "plan price", "revenue"],
};

const VENDOR_PRESETS: Record<string, Record<string, string[]>> = {
  wodify: {
    name: ["name", "member name", "first_name"],
    email: ["email"],
    status: ["status", "membership_status"],
    joinDate: ["start_date", "join_date", "created"],
    cancelDate: ["end_date", "cancel_date"],
    monthlyRate: ["rate", "price", "amount"],
  },
  pushpress: {
    name: ["name", "full_name", "member_name"],
    email: ["email", "email_address"],
    status: ["status", "membership_status"],
    joinDate: ["created_at", "join_date", "signup_date"],
    cancelDate: ["cancel_date", "cancelled_date"],
    monthlyRate: ["amount", "monthly_rate", "price"],
  },
  zenplanner: {
    name: ["member", "name", "member_name"],
    email: ["email"],
    status: ["status"],
    joinDate: ["joined", "start_date", "enrollment_date"],
    cancelDate: ["cancelled", "end_date"],
    monthlyRate: ["dues", "rate", "amount"],
  },
};

export function parseHeaders(csvText: string): { headers: string[]; lines: string[] } {
  const lines = csvText.trim().split("\n");
  if (lines.length < 1) {
    throw new Error("File is empty");
  }
  const headerLine = lines[0].replace(/\r/g, "");
  const headers = parseCSVLine(headerLine);
  return { headers, lines };
}

export function detectMapping(headers: string[]): { mapping: ColumnMapping; confidence: Record<string, "high" | "medium" | "low" | "unmapped"> } {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  const mapping: ColumnMapping = { name: -1, email: -1, status: -1, joinDate: -1, cancelDate: -1, monthlyRate: -1 };
  const confidence: Record<string, "high" | "medium" | "low" | "unmapped"> = {};

  for (const [field, synonyms] of Object.entries(HEADER_SYNONYMS)) {
    let bestIdx = -1;
    let bestConf: "high" | "medium" | "low" = "low";

    for (const syn of synonyms) {
      const idx = lowerHeaders.indexOf(syn);
      if (idx >= 0) {
        bestIdx = idx;
        bestConf = syn === synonyms[0] ? "high" : "medium";
        break;
      }
    }

    if (bestIdx === -1) {
      for (let i = 0; i < lowerHeaders.length; i++) {
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
  }

  return { mapping, confidence };
}

export function previewCsv(csvText: string, customMapping?: Partial<ColumnMapping>): PreviewResult {
  const { headers, lines } = parseHeaders(csvText);
  const { mapping: detectedMapping, confidence } = detectMapping(headers);

  const finalMapping = { ...detectedMapping, ...customMapping };

  const dataLines = lines.slice(1).filter(l => l.replace(/\r/g, "").trim() !== "");
  const totalRows = dataLines.length;

  const sampleRows: string[][] = [];
  const allErrors: RowError[] = [];
  const parsedPreview: ParsedMember[] = [];
  let validRows = 0;
  let errorRows = 0;

  const maxPreview = Math.min(totalRows, 20);
  for (let i = 0; i < maxPreview; i++) {
    const line = dataLines[i].replace(/\r/g, "");
    const cols = parseCSVLine(line);
    sampleRows.push(cols);

    const { member, errors } = normalizeAndValidateRow(cols, finalMapping, i + 2);
    if (errors.length > 0) {
      errorRows++;
      allErrors.push(...errors);
    } else if (member) {
      validRows++;
      parsedPreview.push(member);
    }
  }

  if (totalRows > maxPreview) {
    for (let i = maxPreview; i < totalRows; i++) {
      const line = dataLines[i].replace(/\r/g, "");
      const cols = parseCSVLine(line);
      const { errors } = normalizeAndValidateRow(cols, finalMapping, i + 2);
      if (errors.length > 0) {
        errorRows++;
        allErrors.push(...errors.slice(0, 3));
      } else {
        validRows++;
      }
    }
  }

  return {
    headers,
    sampleRows,
    totalRows,
    detectedMapping: finalMapping,
    mappingConfidence: confidence,
    validationSummary: {
      validRows,
      errorRows,
      errors: allErrors.slice(0, 100),
    },
    parsedPreview,
  };
}

export function parseAllRows(csvText: string, mapping: ColumnMapping): ImportResult {
  const { lines } = parseHeaders(csvText);
  const dataLines = lines.slice(1).filter(l => l.replace(/\r/g, "").trim() !== "");

  const members: ParsedMember[] = [];
  const errors: RowError[] = [];
  let validRows = 0;
  let errorRows = 0;

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].replace(/\r/g, "");
    const cols = parseCSVLine(line);
    const { member, errors: rowErrors } = normalizeAndValidateRow(cols, mapping, i + 2);

    if (rowErrors.length > 0) {
      errorRows++;
      errors.push(...rowErrors);
    } else if (member) {
      validRows++;
      members.push(member);
    }
  }

  return { members, errors, totalRows: dataLines.length, validRows, errorRows };
}

function normalizeAndValidateRow(
  cols: string[],
  mapping: ColumnMapping,
  rowNum: number
): { member: ParsedMember | null; errors: RowError[] } {
  const errors: RowError[] = [];

  const rawName = mapping.name >= 0 ? (cols[mapping.name] || "").trim() : "";
  const rawEmail = mapping.email >= 0 ? (cols[mapping.email] || "").trim() : "";
  const rawStatus = mapping.status >= 0 ? (cols[mapping.status] || "").trim() : "";
  const rawJoinDate = mapping.joinDate >= 0 ? (cols[mapping.joinDate] || "").trim() : "";
  const rawCancelDate = mapping.cancelDate >= 0 ? (cols[mapping.cancelDate] || "").trim() : "";
  const rawRate = mapping.monthlyRate >= 0 ? (cols[mapping.monthlyRate] || "").trim() : "";

  const name = sanitizeText(rawName);
  if (!name) {
    errors.push({ row: rowNum, field: "name", value: rawName, message: "Name is required" });
  }

  const joinDate = parseDate(rawJoinDate);
  if (!joinDate && rawJoinDate) {
    errors.push({ row: rowNum, field: "joinDate", value: rawJoinDate, message: `Could not parse date "${rawJoinDate}". Expected formats: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, etc.` });
  } else if (!joinDate && !rawJoinDate) {
    errors.push({ row: rowNum, field: "joinDate", value: "", message: "Join date is required" });
  }

  let cancelDate: string | null = null;
  if (rawCancelDate) {
    cancelDate = parseDate(rawCancelDate);
    if (!cancelDate) {
      errors.push({ row: rowNum, field: "cancelDate", value: rawCancelDate, message: `Could not parse cancel date "${rawCancelDate}"` });
    }
  }

  const email = rawEmail ? sanitizeEmail(rawEmail) : null;
  if (rawEmail && !email) {
    errors.push({ row: rowNum, field: "email", value: rawEmail, message: `Invalid email format "${rawEmail}"` });
  }

  const status = normalizeStatus(rawStatus);
  const monthlyRate = parseRate(rawRate);

  if (errors.length > 0) {
    return { member: null, errors };
  }

  return {
    member: { name, email, status, joinDate: joinDate!, cancelDate, monthlyRate },
    errors: [],
  };
}

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function sanitizeText(s: string): string {
  return s.replace(/[<>{}]/g, "").replace(/\s+/g, " ").trim();
}

function sanitizeEmail(s: string): string | null {
  const cleaned = s.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(cleaned) ? cleaned : null;
}

function normalizeStatus(s: string): string {
  if (!s) return "active";
  const lower = s.toLowerCase().trim();
  if (["cancelled", "canceled", "inactive", "former", "dropped", "expired", "terminated", "left", "churned"].includes(lower)) return "cancelled";
  if (["active", "current", "enrolled", "member"].includes(lower)) return "active";
  if (["frozen", "paused", "hold", "on hold", "suspended"].includes(lower)) return "active";
  return "active";
}

export function parseDate(s: string): string | null {
  if (!s) return null;
  const cleaned = s.trim().replace(/^["']|["']$/g, "");

  const isoMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return validateAndFormat(parseInt(y), parseInt(m), parseInt(d));
  }

  const usMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, m, d, y] = usMatch;
    return validateAndFormat(parseInt(y), parseInt(m), parseInt(d));
  }

  const usMatch2 = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (usMatch2) {
    const [, m, d, y] = usMatch2;
    return validateAndFormat(parseInt(y), parseInt(m), parseInt(d));
  }

  const euMatch = cleaned.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (euMatch) {
    const [, d, m, y] = euMatch;
    return validateAndFormat(parseInt(y), parseInt(m), parseInt(d));
  }

  const shortYearUs = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (shortYearUs) {
    const [, m, d, yy] = shortYearUs;
    const year = parseInt(yy) + (parseInt(yy) > 50 ? 1900 : 2000);
    return validateAndFormat(year, parseInt(m), parseInt(d));
  }

  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const namedMatch = cleaned.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (namedMatch) {
    const [, monthStr, d, y] = namedMatch;
    const mIdx = monthNames.indexOf(monthStr.toLowerCase().slice(0, 3));
    if (mIdx >= 0) {
      return validateAndFormat(parseInt(y), mIdx + 1, parseInt(d));
    }
  }

  const namedMatch2 = cleaned.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/i);
  if (namedMatch2) {
    const [, d, monthStr, y] = namedMatch2;
    const mIdx = monthNames.indexOf(monthStr.toLowerCase().slice(0, 3));
    if (mIdx >= 0) {
      return validateAndFormat(parseInt(y), mIdx + 1, parseInt(d));
    }
  }

  const d = new Date(cleaned);
  if (!isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2100) {
    return d.toISOString().slice(0, 10);
  }

  return null;
}

function validateAndFormat(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseRate(s: string): string {
  if (!s) return "0";
  const cleaned = s.replace(/[$,\s€£]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) || num < 0 ? "0" : num.toFixed(2);
}

export function computeFileHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36) + "-" + content.length.toString(36);
}

export function parseMembersCsv(csvText: string): ParsedMember[] {
  const { headers } = parseHeaders(csvText);
  const { mapping } = detectMapping(headers);

  if (mapping.name === -1) throw new Error("CSV must have a 'name' column");
  if (mapping.joinDate === -1) throw new Error("CSV must have a 'join_date' column");

  const result = parseAllRows(csvText, mapping);
  return result.members;
}
