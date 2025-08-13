// Chia đều & tính sổ nợ
export function splitEqual(amount, n) {
  if (!Number.isFinite(amount) || n <= 0) return { share: 0, remainder: 0 };
  const share = Math.floor(amount / n);
  return { share, remainder: amount - share * n }; // phần dư coi như payer gánh
}

// Bảo đảm payer nằm trong tập người hưởng lợi
export function normalizeGroup(participants = [], payerEmail = "") {
  const s = new Set(participants.filter(Boolean).map((e) => e.trim()));
  if (payerEmail) s.add(payerEmail);
  return Array.from(s);
}

// Tạo ledger ròng chỉ từ expenses (chưa trừ payments)
export function buildLedger(
  myEmail,
  expensesAsPayer = [],
  expensesWithMe = []
) {
  const theyOweMe = new Map(); // debtorEmail -> amount
  const iOwe = new Map(); // creditorEmail -> amount

  // Tôi là payer -> người khác nợ tôi
  for (const e of expensesAsPayer) {
    const group = normalizeGroup(e.participantsEmails, e.payerEmail);
    const { share } = splitEqual(e.amount, group.length);
    for (const p of group) {
      if (p === e.payerEmail) continue; // payer không nợ chính mình
      theyOweMe.set(p, (theyOweMe.get(p) || 0) + share);
    }
  }

  // Tôi là participant (và payer != tôi) -> tôi nợ payer
  for (const e of expensesWithMe) {
    if (e.payerEmail === myEmail) continue;
    const group = normalizeGroup(e.participantsEmails, e.payerEmail);
    const { share } = splitEqual(e.amount, group.length);
    iOwe.set(e.payerEmail, (iOwe.get(e.payerEmail) || 0) + share);
  }

  // Trả về mảng đã sắp theo tiền giảm dần
  const sortDesc = (a, b) => b.total - a.total;
  return {
    iOwe: Array.from(iOwe, ([email, total]) => ({ email, total })).sort(
      sortDesc
    ),
    theyOweMe: Array.from(theyOweMe, ([email, total]) => ({
      email,
      total,
    })).sort(sortDesc),
  };
}
