import * as Welcome from "./pages/welcome.js";
import * as Add from "./pages/add-expense.js";
import * as Mine from "./pages/my-requests.js";
import * as Debts from "./pages/debts.js";
import * as PayDebt from "./pages/pay-debt.js";
import * as AdminQueue from "./pages/admin-queue.js";
import * as Users from "./pages/users.js";

const routes = {
  "#/welcome": Welcome,
  "#/add": Add,
  "#/mine": Mine,
  "#/debts": Debts,
  "#/pay-debt": PayDebt,
  "#/admin/queue": AdminQueue,
  "#/users": Users,
};

// Guard: các route yêu cầu đăng nhập
let _isAuthed = false;
const PROTECTED = [
  "#/add",
  "#/mine",
  "#/dashboard",
  "#/pay",
  "#/admin/queue",
  "#/admin/overview",
  "#/debts",
];
export function setAuthGuardState(v) {
  _isAuthed = !!v;
}

export function attachRouter() {
  const go = async () => {
    const key = location.hash.split("?")[0] || "#/welcome";
    if (PROTECTED.includes(key) && !_isAuthed) {
      location.hash = "#/welcome";
      return;
    }
    const mod = routes[key] || Welcome;
    await mod.render?.();
  };
  window.addEventListener("hashchange", go);
  go();
}
