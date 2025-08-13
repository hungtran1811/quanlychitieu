export function splitEqual(amount, n) {
  if (!Number.isFinite(amount) || n <= 0) return { share: 0, remainder: 0 };
  const share = Math.floor(amount / n);
  return { share, remainder: amount - share * n };
}
export function normalizeGroup(participants = [], payerEmail = "") {
  const s = new Set(
    participants.filter(Boolean).map((e) => e.trim().toLowerCase())
  );
  if (payerEmail) s.add(payerEmail.toLowerCase());
  return Array.from(s);
}

export function buildLedger(
  myEmail,
  expensesAsPayer = [],
  expensesWithMe = []
) {
  const me = (myEmail || "").toLowerCase();
  const iOwe = new Map(); // tôi nợ người khác
  const theyOweMe = new Map(); // người khác nợ tôi

  for (const e of expensesAsPayer) {
    const payer = (e.payerEmail || "").toLowerCase();
    const group = normalizeGroup(
      e.participantsEmails || e.participantEmails || [],
      payer
    );
    const { share } = splitEqual(+e.amount || 0, group.length);
    for (const p of group) {
      if (p !== payer) theyOweMe.set(p, (theyOweMe.get(p) || 0) + share);
    }
  }
  for (const e of expensesWithMe) {
    const payer = (e.payerEmail || "").toLowerCase();
    if (payer === me) continue;
    const group = normalizeGroup(
      e.participantsEmails || e.participantEmails || [],
      payer
    );
    const { share } = splitEqual(+e.amount || 0, group.length);
    iOwe.set(payer, (iOwe.get(payer) || 0) + share);
  }
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

export function applyPayments(ledger, paymentsOut = [], paymentsIn = []) {
  const iO = new Map(ledger.iOwe.map((x) => [x.email.toLowerCase(), x.total]));
  const oM = new Map(
    ledger.theyOweMe.map((x) => [x.email.toLowerCase(), x.total])
  );
  for (const p of paymentsOut) {
    const to = (p.toEmail || "").toLowerCase();
    iO.set(to, Math.max(0, (iO.get(to) || 0) - (+p.amount || 0)));
  }
  for (const p of paymentsIn) {
    const from = (p.fromEmail || "").toLowerCase();
    oM.set(from, Math.max(0, (oM.get(from) || 0) - (+p.amount || 0)));
  }
  const sortDesc = (a, b) => b.total - a.total;
  return {
    iOwe: Array.from(iO, ([email, total]) => ({ email, total }))
      .filter((x) => x.total > 0)
      .sort(sortDesc),
    theyOweMe: Array.from(oM, ([email, total]) => ({ email, total }))
      .filter((x) => x.total > 0)
      .sort(sortDesc),
  };
}

export function sumLedger(ledger) {
  const sum = (arr) => arr.reduce((s, x) => s + (+x.total || 0), 0);
  const tongBanNo = sum(ledger.iOwe);
  const tongNguoiNoBan = sum(ledger.theyOweMe);
  return { tongBanNo, tongNguoiNoBan, net: tongNguoiNoBan - tongBanNo };
}
