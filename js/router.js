import * as Welcome from "./pages/welcome.js";
import * as Add from "./pages/add-expense.js";
import * as Mine from "./pages/my-requests.js";

const routes = {
  "#/welcome": Welcome,
  "#/add": Add,
  "#/mine": Mine,
};

export function attachRouter() {
  const go = async () => {
    const key = location.hash.split("?")[0] || "#/welcome";
    const mod = routes[key] || Welcome;
    await mod.render?.();
  };
  window.addEventListener("hashchange", go);
  go();
}
