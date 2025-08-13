import * as Welcome from "./pages/welcome.js";
import * as Add from "./pages/add-expense.js";
import * as Mine from "./pages/my-requests.js";
import * as Dash from "./pages/my-dashboard.js"; // skeleton
import * as Pay from "./pages/pay-debt.js"; // skeleton
import * as AdminQueue from "./pages/admin-queue.js"; // skeleton
import * as AdminView from "./pages/admin-overview.js"; // skeleton

const routes = {
  "#/welcome": Welcome,
  "#/add": Add,
  "#/mine": Mine,
  "#/dashboard": Dash,
  "#/pay": Pay,
  "#/admin/queue": AdminQueue,
  "#/admin/overview": AdminView,
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
