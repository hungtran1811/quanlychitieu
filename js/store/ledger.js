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
 * cb({ byPerson: Map(email -> { youOwe, theyOwe, detailsYou:[], detailsThey:[] }),
 *      totals: { youOwe, theyOwe, net }, at: Date })
 */
export function subscribeDebtsForUser(myEmail, cb) {
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

  const recompute = () => {
    const byPerson = new Map();
    const ensure = (email) => {
      if (!byPerson.has(email)) {
        byPerson.set(email, {
          youOwe: 0,
          theyOwe: 0,
          detailsYou: [],
          detailsThey: [],
        });
      }
      return byPerson.get(email);
    };

    // 1) Mình là payer: người khác nợ mình (ONLY detailsThey)
    for (const e of EPayer) {
      const amount = +e.amount || 0;
      const members = Array.isArray(e.participantsEmails)
        ? e.participantsEmails
        : [];
      if (!members.length) continue;
      const share = amount / members.length;
      const others = members.filter((x) => x && x !== myEmail);
      for (const p of others) {
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

    // 2) Mình là participant (payer khác mình): mình nợ payer (ONLY detailsYou)
    for (const e of EPart) {
      if (!e || e.payerEmail === myEmail) continue;
      const amount = +e.amount || 0;
      const members = Array.isArray(e.participantsEmails)
        ? e.participantsEmails
        : [];
      if (!members.length) continue;
      const share = amount / members.length;
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

    // 3) Payments mình gửi cho họ: giảm phần mình nợ họ (ONLY detailsYou)
    for (const p of POut) {
      const amt = +p.amount || 0;
      const row = ensure(p.toEmail);
      row.youOwe -= amt; // trừ nợ
      row.detailsYou.push({
        kind: "payment",
        dir: "you->them",
        amount: -amt,
        note: p.note || "",
        date: p.date || p.approvedAt || null,
      });
    }

    // 4) Payments họ gửi cho mình: giảm phần họ nợ mình (ONLY detailsThey)
    for (const p of PIn) {
      const amt = +p.amount || 0;
      const row = ensure(p.fromEmail);
      row.theyOwe -= amt; // trừ nợ
      row.detailsThey.push({
        kind: "payment",
        dir: "them->you",
        amount: -amt,
        note: p.note || "",
        date: p.date || p.approvedAt || null,
      });
    }

    // Chuẩn hoá + tổng
    const totals = { youOwe: 0, theyOwe: 0, net: 0 };
    for (const v of byPerson.values()) {
      // gom chi tiết theo thời gian
      v.detailsYou.sort(
        (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
      );
      v.detailsThey.sort(
        (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
      );

      // clamp về >= 0 để không hiện số âm
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
