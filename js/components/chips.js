// public/js/components/chips.js
/** Minimal chips with suggestion dropdown (multi/single) */
export function mountChips(
  rootEl,
  {
    placeholder = "gõ tên/email để tìm, enter để chọn...",
    multiple = true,
  } = {}
) {
  rootEl.classList.add("chips-input");

  // DOM
  const chipsWrap = document.createElement("div");
  chipsWrap.className = "chips-list";
  const input = document.createElement("input");
  input.type = "text";
  input.autocomplete = "off";
  input.placeholder = placeholder;
  input.className = "chips-control";
  const pop = document.createElement("div");
  pop.className = "suggest-pop hidden";
  rootEl.replaceChildren(chipsWrap, input, pop);

  /** state */
  let items = []; // full items (from outside)
  let selected = []; // array of keys
  let keyToItem = new Map();

  /** helpers */
  const renderChips = () => {
    chipsWrap.innerHTML = "";
    selected.forEach((k) => {
      const it = keyToItem.get(k);
      const chip = document.createElement("div");
      chip.className = "chip";
      const av = document.createElement("div");
      av.className = "av";
      av.textContent = (it?.initial || "?").toUpperCase();
      const lbl = document.createElement("div");
      lbl.className = "tx";
      lbl.textContent = it?.label || k;
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "rm";
      rm.textContent = "×";
      rm.onclick = () => {
        selected = selected.filter((x) => x !== k);
        renderChips();
      };
      chip.append(av, lbl, rm);
      chipsWrap.append(chip);
    });
  };

  const openPop = () => pop.classList.remove("hidden");
  const closePop = () => pop.classList.add("hidden");

  const renderSuggest = (q) => {
    const qq = (q || "").toLowerCase();
    const pool = items
      .filter(
        (it) =>
          it.key.toLowerCase().includes(qq) ||
          it.name.toLowerCase().includes(qq)
      )
      .filter((it) => (multiple ? !selected.includes(it.key) : true));

    if (!pool.length) {
      pop.innerHTML = "";
      closePop();
      return;
    }
    openPop();
    pop.innerHTML = pool
      .slice(0, 30)
      .map(
        (it) => `
      <div class="suggest-item" data-key="${it.key}">
        <div class="av">${(it.initial || "?").toUpperCase()}</div>
        <div class="col">
          <div class="nm">${it.name}</div>
          <div class="em">${it.email}</div>
        </div>
      </div>
    `
      )
      .join("");

    Array.from(pop.querySelectorAll(".suggest-item")).forEach((el) => {
      el.addEventListener("click", () => {
        const k = el.dataset.key;
        if (!multiple) selected = [k];
        else if (!selected.includes(k)) selected.push(k);
        renderChips();
        input.value = "";
        closePop();
        input.focus();
      });
    });
  };

  input.addEventListener("input", () => renderSuggest(input.value));
  input.addEventListener("focus", () => renderSuggest(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closePop();
      return;
    }
    if (!multiple && e.key === "Backspace" && !input.value) {
      selected = [];
      renderChips();
    }
    if (multiple && e.key === "Backspace" && !input.value && selected.length) {
      selected.pop();
      renderChips();
    }
    // Enter không tự thêm text raw – chỉ chọn từ gợi ý
    if (e.key === "Enter") {
      e.preventDefault();
    }
  });
  document.addEventListener("click", (e) => {
    if (!rootEl.contains(e.target)) closePop();
  });

  return {
    /** nạp data gợi ý */
    setItems(list) {
      items = Array.isArray(list) ? list : [];
      keyToItem = new Map(items.map((x) => [x.key, x]));
      renderSuggest(input.value);
    },
    /** preset giá trị */
    setSelected(keys) {
      selected = (keys || []).filter(Boolean);
      renderChips();
    },
    /** lấy giá trị */
    getSelected() {
      return [...selected];
    },
  };
}
