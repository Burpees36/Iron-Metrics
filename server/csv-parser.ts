export interface ParsedMember {
  name: string;
  email: string | null;
  status: string;
  joinDate: string;
  cancelDate: string | null;
  monthlyRate: string;
}

export function parseMembersCsv(csvText: string): ParsedMember[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("CSV must have a header row and at least one data row");
  }

  const headerLine = lines[0].toLowerCase().replace(/\r/g, "");
  const headers = parseCSVLine(headerLine);

  const nameIdx = findCol(headers, ["name", "member_name", "full_name", "member name"]);
  const emailIdx = findCol(headers, ["email", "email_address", "e-mail"]);
  const statusIdx = findCol(headers, ["status", "membership_status", "member_status"]);
  const joinIdx = findCol(headers, ["join_date", "joined", "start_date", "join date", "start date"]);
  const cancelIdx = findCol(headers, ["cancel_date", "cancelled", "end_date", "cancel date", "end date", "cancellation_date"]);
  const rateIdx = findCol(headers, ["monthly_rate", "rate", "price", "monthly_price", "monthly rate", "amount"]);

  if (nameIdx === -1) throw new Error("CSV must have a 'name' column");
  if (joinIdx === -1) throw new Error("CSV must have a 'join_date' column");

  const results: ParsedMember[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].replace(/\r/g, "").trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    const name = cols[nameIdx]?.trim();
    if (!name) continue;

    const email = emailIdx >= 0 ? cols[emailIdx]?.trim() || null : null;
    const status = statusIdx >= 0 ? normalizeStatus(cols[statusIdx]?.trim()) : "active";
    const joinDate = parseDate(cols[joinIdx]?.trim());
    const cancelDate = cancelIdx >= 0 && cols[cancelIdx]?.trim() ? parseDate(cols[cancelIdx].trim()) : null;
    const monthlyRate = rateIdx >= 0 ? parseRate(cols[rateIdx]?.trim()) : "0";

    if (!joinDate) continue;

    results.push({ name, email, status, joinDate, cancelDate, monthlyRate });
  }

  return results;
}

function parseCSVLine(line: string): string[] {
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

function findCol(headers: string[], names: string[]): number {
  for (const name of names) {
    const idx = headers.indexOf(name);
    if (idx >= 0) return idx;
  }
  return -1;
}

function normalizeStatus(s: string): string {
  if (!s) return "active";
  const lower = s.toLowerCase();
  if (lower === "cancelled" || lower === "canceled" || lower === "inactive") return "cancelled";
  return "active";
}

function parseDate(s: string): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseRate(s: string): string {
  if (!s) return "0";
  const cleaned = s.replace(/[$,]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? "0" : num.toFixed(2);
}
