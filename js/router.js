import * as Welcome from "./pages/welcome.js";
import * as Add from "./pages/add-expense.js";
import * as Mine from "./pages/my-requests.js";
import * as Debts from "./pages/debts.js";
import * as PayDebt from "./pages/pay-debt.js";
import * as AdminQueue from "./pages/admin-queue.js";
import * as Admin from "./pages/admin-overview.js";
import * as History from "./pages/history.js";
import * as Users from "./pages/users.js";
import * as HouseBill from "./pages/house-bill.js";

const routes = {
  "#/welcome": Welcome,
  "#/add": Add,
  "#/mine": Mine,
  "#/debts": Debts,
  "#/pay-debt": PayDebt,
  "#/admin/queue": AdminQueue,
  "#/admin": Admin,
  "#/history": History,
  "#/users": Users,
  "#/house-bill": HouseBill,
};

// Guard: các route yêu cầu đăng nhập
let _isAuthed = false;
const PROTECTED = [
  "#/add",
  "#/mine",
  "#/dashboard",
  "#/pay",
  "#/admin/queue",
  "#/admin",
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
