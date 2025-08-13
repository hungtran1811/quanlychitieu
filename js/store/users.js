import { getDb } from "./firestore.js";
import {
  collection,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/** Realtime toàn bộ users -> [{ email, name }] (unique + sort) */
export function subscribeAllUsers(onChange) {
  const unSub = onSnapshot(collection(getDb(), "users"), (snap) => {
    const list = snap.docs
      .map((d) => {
        const x = d.data() || {};
        return {
          email: (x.email || "").trim(),
          name: (x.displayName || "").trim(),
        };
      })
      .filter((u) => u.email);

    const map = new Map(); // unique by email
    for (const u of list) if (!map.has(u.email)) map.set(u.email, u);
    const result = Array.from(map.values()).sort((a, b) =>
      a.email.localeCompare(b.email)
    );
    onChange(result);
  });
  return unSub;
}
