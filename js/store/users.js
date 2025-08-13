import { getDb } from "./firestore.js";
import {
  collection,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export function subscribeAllUsers(onChange) {
  const unSub = onSnapshot(collection(getDb(), "users"), (snap) => {
    const arr = snap.docs
      .map((d) => {
        const x = d.data() || {};
        return {
          email: (x.email || "").trim(),
          name: (x.displayName || "").trim(),
        };
      })
      .filter((u) => u.email);
    // unique by email + sort
    const map = new Map();
    for (const u of arr) if (!map.has(u.email)) map.set(u.email, u);
    onChange(
      Array.from(map.values()).sort((a, b) => a.email.localeCompare(b.email))
    );
  });
  return unSub;
}
