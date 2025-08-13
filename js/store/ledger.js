import { getDb } from "./firestore.js";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/**
 * Realtime tính nợ theo từng người cho 1 email.
 * opts: { start?:Date, end?:Date } dùng để lọc chi tiết theo thời gian (client filter).
 * cb({ byPerson: Map(email -> { youOwe, theyOwe, detailsYou[], detailsThey[] }),
 *      totals: { youOwe, theyOwe, net }, at: Date })
 */
export function subscribeDebtsForUser(myEmail, cb, opts = {}) {
  const db = getDb();

  const qEPayer = query(
    collection(db, "expenses"),
    where("payerEmail", "==", myEmail),
    orderBy("date", "desc")
  );
  const qEPart = query(
    collection(db, "expenses"),
    where("participantsEmails", "array-contains", myEmail),
    orderBy("date", "desc")
  );
  const qPOut = query(
    collection(db, "payments"),
    where("fromEmail", "==", myEmail),
    orderBy("date", "desc")
  );
  const qPIn = query(
    collection(db, "payments"),
    where("toEmail", "==", myEmail),
    orderBy("date", "desc")
  );

  let EPayer = [],
    EPart = [],
    POut = [],
    PIn = [];
  const inRange = (d) => {
    if (!opts.start && !opts.end) return true;
    const t = +new Date(d || 0);
    if (opts.start && t < +opts.start) return false;
    if (opts.end && t > +opts.end) return false;
    return true;
  };

  const recompute = () => {
    const byPerson = new Map();
    const ensure = (email) => {
      if (!byPerson.has(email))
        byPerson.set(email, {
          youOwe: 0,
          theyOwe: 0,
          detailsYou: [],
          detailsThey: [],
        });
      return byPerson.get(email);
    };

    for (const e of EPayer) {
      if (!inRange(e.date || e.approvedAt)) continue;
      const members = Array.isArray(e.participantsEmails)
        ? e.participantsEmails
        : [];
      if (!members.length) continue;
      const share = (+e.amount || 0) / members.length;
      for (const p of members.filter((x) => x && x !== myEmail)) {
        const row = ensure(p);
        row.theyOwe += share;
        row.detailsThey.push({
          kind: "expense",
          dir: "them->you",
          amount: share,
          note: e.note || "",
          date: e.date || e.approvedAt || null,
        });
      }
    }
    for (const e of EPart) {
      if (e?.payerEmail === myEmail) continue;
      if (!inRange(e.date || e.approvedAt)) continue;
      const members = Array.isArray(e.participantsEmails)
        ? e.participantsEmails
        : [];
      if (!members.length) continue;
      const share = (+e.amount || 0) / members.length;
      const row = ensure(e.payerEmail);
      row.youOwe += share;
      row.detailsYou.push({
        kind: "expense",
        dir: "you->them",
        amount: share,
        note: e.note || "",
        date: e.date || e.approvedAt || null,
      });
    }
    for (const p of POut) {
      if (!inRange(p.date || p.approvedAt)) continue;
      const row = ensure(p.toEmail);
      const amt = +p.amount || 0;
      row.youOwe -= amt;
      row.detailsYou.push({
        kind: "payment",
        dir: "you->them",
        amount: -amt,
        note: p.note || "",
        date: p.date || p.approvedAt || null,
      });
    }
    for (const p of PIn) {
      if (!inRange(p.date || p.approvedAt)) continue;
      const row = ensure(p.fromEmail);
      const amt = +p.amount || 0;
      row.theyOwe -= amt;
      row.detailsThey.push({
        kind: "payment",
        dir: "them->you",
        amount: -amt,
        note: p.note || "",
        date: p.date || p.approvedAt || null,
      });
    }

    const totals = { youOwe: 0, theyOwe: 0, net: 0 };
    for (const v of byPerson.values()) {
      v.detailsYou.sort(
        (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
      );
      v.detailsThey.sort(
        (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
      );
      v.youOwe = Math.max(0, Math.round(v.youOwe));
      v.theyOwe = Math.max(0, Math.round(v.theyOwe));
      totals.youOwe += v.youOwe;
      totals.theyOwe += v.theyOwe;
    }
    totals.net = totals.theyOwe - totals.youOwe;

    cb({ byPerson, totals, at: new Date() });
  };

  const unsub1 = onSnapshot(qEPayer, (s) => {
    EPayer = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    recompute();
  });
  const unsub2 = onSnapshot(qEPart, (s) => {
    EPart = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    recompute();
  });
  const unsub3 = onSnapshot(qPOut, (s) => {
    POut = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    recompute();
  });
  const unsub4 = onSnapshot(qPIn, (s) => {
    PIn = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    recompute();
  });

  return () => {
    unsub1();
    unsub2();
    unsub3();
    unsub4();
  };
}
