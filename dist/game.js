"use strict";

const STORAGE_KEY = "boardroom8-save-v1";
const MAX_ROUNDS = 8;
const MATERIAL_COST = 3;
const PRODUCTION_COST = 2;
const EMPLOYEE_COST = 15;
const MACHINE_COST = 35;

const marketStates = [
  { label: "冷え込み", demand: 17, meter: 25 },
  { label: "やや低調", demand: 21, meter: 40 },
  { label: "標準", demand: 24, meter: 55 },
  { label: "好調", demand: 28, meter: 72 },
  { label: "活況", demand: 32, meter: 90 },
];

const events = [
  { name: "通常営業", description: "大きな市場変動はありませんでした。", demand: 0, expense: 0 },
  { name: "地域メディアで紹介", description: "商品の知名度が上がり、需要が増えました。", demand: 5, expense: 0 },
  { name: "競合が値下げ", description: "価格競争が起こり、需要が下がりました。", demand: -4, expense: 0 },
  { name: "設備の臨時点検", description: "安全な生産のため、点検費が発生しました。", demand: 0, expense: 8 },
  { name: "口コミが拡大", description: "顧客からの評判で需要が伸びました。", demand: 3, expense: 0 },
  { name: "物流費の上昇", description: "追加の物流費が発生しました。", demand: 0, expense: 5 },
];

const tips = [
  "高値を付けすぎると、在庫が十分でも販売数が伸びません。",
  "社員と設備への投資は、残り期間が長いほど回収しやすくなります。",
  "売れ残った製品には保管費がかかります。需要予測を活用しましょう。",
  "広告費は需要を増やしますが、商品の在庫がなければ効果を活かせません。",
  "現金をすべて使い切らず、固定費と不測の出費に備えましょう。",
];

const initialState = () => ({
  round: 1,
  cash: 300,
  materials: 10,
  products: 5,
  employees: 2,
  machines: 1,
  totalProfit: 0,
  totalSales: 0,
  history: [],
  marketIndex: 2,
  pendingHire: false,
  pendingMachine: false,
  finished: false,
  lastCash: 300,
});

let state = loadState();

const $ = (id) => document.getElementById(id);
const inputs = ["buyMaterials", "produceUnits", "salePrice", "adSpend"];

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Number.isInteger(saved.round) && saved.round >= 1) return { ...initialState(), ...saved };
  } catch (_) { /* start fresh */ }
  return initialState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function money(value) {
  return `${Math.round(value).toLocaleString("ja-JP")}万円`;
}

function numberValue(id) {
  const input = $(id);
  const min = Number(input.min);
  const max = Number(input.max);
  const value = Math.max(min, Math.min(max, Number(input.value) || 0));
  input.value = value;
  return value;
}

function capacity() {
  return Math.min(state.employees * 5, state.machines * 10 + 10);
}

function fixedCost(employees = state.employees, machines = state.machines) {
  return 8 + employees * 4 + machines * 3;
}

function getPlan() {
  return {
    buy: numberValue("buyMaterials"),
    produce: numberValue("produceUnits"),
    price: numberValue("salePrice"),
    ads: numberValue("adSpend"),
  };
}

function planCost(plan) {
  return plan.buy * MATERIAL_COST + plan.produce * PRODUCTION_COST + plan.ads
    + (state.pendingHire ? EMPLOYEE_COST : 0)
    + (state.pendingMachine ? MACHINE_COST : 0);
}

function expectedDemand(plan) {
  const market = marketStates[state.marketIndex];
  const priceEffect = (10 - plan.price) * 2.2;
  return Math.max(0, Math.round(market.demand + priceEffect + plan.ads * 0.8));
}

function validatePlan(plan) {
  const futureMaterials = state.materials + plan.buy;
  const futureEmployees = state.employees + (state.pendingHire ? 1 : 0);
  const futureMachines = state.machines + (state.pendingMachine ? 1 : 0);
  const futureCapacity = Math.min(futureEmployees * 5, futureMachines * 10 + 10);
  if (plan.produce > futureMaterials) return `原材料が${plan.produce - futureMaterials}個不足しています。`;
  if (plan.produce > futureCapacity) return `生産能力を${plan.produce - futureCapacity}個超えています。`;
  if (planCost(plan) > state.cash) return `予定支出が現金を${money(planCost(plan) - state.cash)}超えています。`;
  return "";
}

function updateForecast() {
  if (state.finished) return;
  const plan = getPlan();
  const cost = planCost(plan);
  const available = state.products + plan.produce;
  const demand = expectedDemand(plan);
  const expectedUnits = Math.min(available, demand);
  const gross = expectedUnits * plan.price;
  const expectedFixed = fixedCost(
    state.employees + (state.pendingHire ? 1 : 0),
    state.machines + (state.pendingMachine ? 1 : 0)
  );
  $("plannedCost").textContent = `予定支出 ${money(cost)}`;
  $("forecast").innerHTML = `<span>需要予測 約${demand}個 ／ 販売可能 ${available}個</span><strong>予想期末現金 ${money(state.cash - cost + gross - expectedFixed)}</strong>`;
  const error = validatePlan(plan);
  $("validationMessage").textContent = error;
  $("executeButton").disabled = Boolean(error);
}

function render() {
  const market = marketStates[state.marketIndex];
  const delta = state.cash - state.lastCash;
  $("roundTitle").textContent = `第${Math.min(state.round, MAX_ROUNDS)}期 / 全${MAX_ROUNDS}期`;
  $("roundMessage").textContent = state.finished ? "最終決算が完了しました。" : "需要を読み、今期の経営計画を決めてください。";
  $("marketLabel").textContent = market.label;
  $("marketMeter").style.width = `${market.meter}%`;
  $("marketHint").textContent = `基準需要 ${market.demand}個`;
  $("cashValue").textContent = money(state.cash);
  $("cashDelta").textContent = state.history.length ? `前期比 ${delta >= 0 ? "+" : ""}${money(delta)}` : "開始資金";
  $("productValue").textContent = `${state.products}個`;
  $("materialValue").textContent = `原材料 ${state.materials}個`;
  $("capacityValue").textContent = `${capacity()}個 / 期`;
  $("staffValue").textContent = `社員 ${state.employees}人・設備 ${state.machines}台`;
  $("profitValue").textContent = money(state.totalProfit);
  $("hireButton").classList.toggle("selected", state.pendingHire);
  $("machineButton").classList.toggle("selected", state.pendingMachine);
  $("hireButton").setAttribute("aria-pressed", String(state.pendingHire));
  $("machineButton").setAttribute("aria-pressed", String(state.pendingMachine));
  $("executeButton").textContent = `この計画で第${Math.min(state.round, MAX_ROUNDS)}期を実行`;
  $("tipText").textContent = tips[(state.round - 1) % tips.length];
  renderLedger();
  updateForecast();
}

function renderLedger() {
  const hasHistory = state.history.length > 0;
  $("emptyLedger").hidden = hasHistory;
  $("ledgerWrap").hidden = !hasHistory;
  $("ledgerBody").innerHTML = state.history.slice().reverse().map((row) =>
    `<tr><td>第${row.round}期</td><td>${money(row.revenue)}</td><td class="${row.profit >= 0 ? "positive" : "negative"}">${row.profit >= 0 ? "+" : ""}${money(row.profit)}</td><td>${money(row.cash)}</td></tr>`
  ).join("");
}

function executeRound() {
  const plan = getPlan();
  const error = validatePlan(plan);
  if (error) { $("validationMessage").textContent = error; return; }

  const openingCash = state.cash;
  const hired = state.pendingHire ? 1 : 0;
  const addedMachine = state.pendingMachine ? 1 : 0;
  state.employees += hired;
  state.machines += addedMachine;
  state.materials += plan.buy;
  state.materials -= plan.produce;
  state.products += plan.produce;

  const event = events[Math.floor(Math.random() * events.length)];
  const demandNoise = Math.floor(Math.random() * 7) - 3;
  const demand = Math.max(0, expectedDemand(plan) + event.demand + demandNoise);
  const sold = Math.min(state.products, demand);
  const revenue = sold * plan.price;
  state.products -= sold;

  const variable = plan.buy * MATERIAL_COST + plan.produce * PRODUCTION_COST;
  const investments = hired * EMPLOYEE_COST + addedMachine * MACHINE_COST;
  const fixed = fixedCost() + Math.ceil(state.products * 0.5);
  const expenses = variable + plan.ads + fixed + event.expense + investments;
  const profit = revenue - (variable + plan.ads + fixed + event.expense);
  state.lastCash = openingCash;
  state.cash = openingCash + revenue - expenses;
  state.totalProfit += profit;
  state.totalSales += revenue;
  state.history.push({ round: state.round, sold, demand, revenue, profit, cash: state.cash, event: event.name });
  state.pendingHire = false;
  state.pendingMachine = false;

  showResult({ round: state.round, event, sold, demand, revenue, variable, fixed, profit, cash: state.cash });
  state.round += 1;

  if (state.cash < 0 || state.round > MAX_ROUNDS) {
    state.finished = true;
    saveState();
    render();
    setTimeout(showGameOver, 350);
    return;
  }

  const movement = Math.floor(Math.random() * 3) - 1;
  state.marketIndex = Math.max(0, Math.min(marketStates.length - 1, state.marketIndex + movement));
  $("buyMaterials").value = 10;
  $("produceUnits").value = Math.min(15, capacity());
  saveState();
  render();
}

function showResult(result) {
  $("resultTitle").textContent = `第${result.round}期 決算`;
  $("eventPill").textContent = `${result.event.name}｜${result.event.description}`;
  $("resultGrid").innerHTML = [
    ["販売数", `${result.sold}個 / 需要${result.demand}個`],
    ["売上高", money(result.revenue)],
    ["変動費", money(result.variable)],
    ["固定・保管費", money(result.fixed)],
    ["営業利益", `${result.profit >= 0 ? "+" : ""}${money(result.profit)}`],
    ["期末現金", money(result.cash)],
  ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
  $("resultNote").textContent = result.sold < result.demand
    ? `需要に対して${result.demand - result.sold}個の販売機会を逃しました。次期は生産量を見直しましょう。`
    : state.products > 8
      ? `製品在庫が${state.products}個残りました。価格または生産量の調整を検討しましょう。`
      : "需要と供給のバランスが取れています。現金残高にも注意して次期へ進みましょう。";
  $("resultDialog").showModal();
}

function companyValue() {
  return state.cash + state.materials * MATERIAL_COST + state.products * 5;
}

function showGameOver() {
  $("resultDialog").close();
  const value = companyValue();
  let grade = "D";
  let message = "資金繰りを優先し、仕入れと投資を小さく始めると安定します。";
  if (state.cash < 0) {
    grade = "E";
    $("finalTitle").textContent = "資金が尽き、会社は倒産しました";
  } else if (value >= 650) { grade = "S"; message = "高収益と十分な資産を両立した、見事な経営です。"; }
  else if (value >= 500) { grade = "A"; message = "堅実に会社を成長させました。価格戦略も良好です。"; }
  else if (value >= 380) { grade = "B"; message = "会社を着実に成長させました。さらに在庫効率を磨けます。"; }
  else if (value >= 280) { grade = "C"; message = "会社を守り切りました。利益率か販売数を改善してみましょう。"; }
  $("finalGrade").textContent = grade;
  if (state.cash >= 0) $("finalTitle").textContent = "8期の経営、お疲れさまでした";
  $("finalSummary").textContent = message;
  $("finalStats").innerHTML = [
    ["最終自己資本", money(value)],
    ["累計売上", money(state.totalSales)],
    ["累計利益", money(state.totalProfit)],
  ].map(([label, valueText]) => `<div><span>${label}</span><strong>${valueText}</strong></div>`).join("");
  $("gameOverDialog").showModal();
}

function resetGame(confirmFirst = true) {
  if (confirmFirst && !window.confirm("現在の経営記録を消して、最初から始めますか？")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = initialState();
  $("gameOverDialog").close();
  saveState();
  render();
}

function registerWebMCP() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const register = (tool) => Promise.resolve(context.registerTool(tool)).catch(() => {});
  register({
    name: "read_company_status",
    title: "会社の状態を確認",
    description: "現在の期、現金、在庫、生産能力、市場状況を読み取ります。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute() { return { round: state.round, cash: state.cash, materials: state.materials, products: state.products, capacity: capacity(), market: marketStates[state.marketIndex].label }; },
  });
  register({
    name: "configure_management_plan",
    title: "経営計画を設定",
    description: "今期の仕入れ、生産、販売価格、広告費を画面に設定します。決算は実行しません。",
    inputSchema: {
      type: "object",
      properties: {
        buyMaterials: { type: "integer", minimum: 0, maximum: 80 },
        produceUnits: { type: "integer", minimum: 0, maximum: 80 },
        salePrice: { type: "integer", minimum: 6, maximum: 18 },
        adSpend: { type: "integer", minimum: 0, maximum: 30 },
      },
      required: ["buyMaterials", "produceUnits", "salePrice", "adSpend"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      for (const id of inputs) {
        if (!Number.isInteger(input[id])) throw new Error(`${id} must be an integer`);
        const element = $(id);
        if (input[id] < Number(element.min) || input[id] > Number(element.max)) throw new Error(`${id} is outside the allowed range`);
        element.value = input[id];
      }
      updateForecast();
      return { configured: true, validation: validatePlan(getPlan()) || "valid", plannedCost: planCost(getPlan()) };
    },
  });
}

document.querySelectorAll("[data-step]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = $(button.dataset.step);
    input.value = Number(input.value) + Number(button.dataset.delta);
    numberValue(button.dataset.step);
    updateForecast();
  });
});
inputs.forEach((id) => $(id).addEventListener("input", updateForecast));
$("hireButton").addEventListener("click", () => { state.pendingHire = !state.pendingHire; render(); });
$("machineButton").addEventListener("click", () => { state.pendingMachine = !state.pendingMachine; render(); });
$("executeButton").addEventListener("click", executeRound);
$("helpButton").addEventListener("click", () => $("helpDialog").showModal());
$("resetButton").addEventListener("click", () => resetGame(true));
$("playAgainButton").addEventListener("click", () => resetGame(false));
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => $(button.dataset.close).close()));
document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
  if (event.target === dialog && dialog.id !== "gameOverDialog") dialog.close();
}));

render();
registerWebMCP();
if (state.finished) setTimeout(showGameOver, 100);
