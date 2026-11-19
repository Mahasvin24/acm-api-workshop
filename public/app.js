const $ = (selector) => document.querySelector(selector);
const example = {
  name: "Campus Picks",
  creator: "Your name",
  description: "Good spots around UCSB.",
  ip: "192.168.1.42",
  port: 3001,
};
const samples = [
  [
    "Campus Picks",
    "Maya",
    "A collection of study spots, ocean views, and places worth the walk.",
    "192.168.1.42",
    3001,
  ],
  [
    "What’s for lunch?",
    "Alex",
    "Tell me your budget. I’ll pick your next lunch in Isla Vista.",
    "192.168.1.28",
    8080,
  ],
  [
    "Daily Affirmations",
    "Sam",
    "A tiny boost of confidence, one GET request at a time.",
    "192.168.1.63",
    3001,
  ],
  [
    "The Aux Cord",
    "Jordan",
    "Add a song to the room’s collaborative playlist.",
    "192.168.1.16",
    4000,
  ],
  [
    "Gaucho Trivia",
    "Priya",
    "How well do you know UCSB? Get a question and send your answer.",
    "192.168.1.84",
    5001,
  ],
  [
    "Pet Roll Call",
    "Leo",
    "A very unofficial directory of very good pets.",
    "192.168.1.55",
    3001,
  ],
].map(([name, creator, description, ip, port], i) => ({
  id: `example-${i}`,
  name,
  creator,
  description,
  ip,
  port,
  created_at: new Date(2026, 10, 18, 18, i).toISOString(),
}));
let apis = [],
  demo = new URLSearchParams(location.search).get("demo") === "1",
  lastGood = null,
  loading = false,
  selected;
let toastTimer;
const baseURL = (api) => `http://${api.ip}:${api.port}`;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 3000);
}
async function copy(value) {
  try {
    if (navigator.clipboard && window.isSecureContext)
      await navigator.clipboard.writeText(value);
    else {
      const input = document.createElement("textarea");
      input.value = value;
      input.style.position = "fixed";
      input.style.opacity = "0";
      // Keep the fallback inside an open modal so the browser permits focus.
      (document.querySelector("dialog[open]") || document.body).append(input);
      input.select();
      const copied = document.execCommand("copy");
      input.remove();
      if (!copied) throw new Error("Clipboard unavailable");
    }
    toast("Copied to clipboard");
  } catch {
    toast("Couldn’t copy. Select the text and copy it manually.");
  }
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function card(api) {
  const button = element("button", "api-card");
  button.type = "button";
  button.setAttribute("aria-label", `View ${api.name} by ${api.creator}`);
  const top = element("div", "card-top");
  top.append(element("h3", "", api.name));
  const creator = element("div", "creator");
  creator.append(
    element("span", "initial", api.creator.slice(0, 1).toUpperCase()),
    element("span", "", api.creator),
  );
  const address = element("div", "address");
  address.append(
    element("span", "", "http://"),
    element("span", "ip", api.ip),
    element("span", "port", `:${api.port}`),
  );
  button.append(
    top,
    creator,
    element("p", "description", api.description),
    address,
  );
  button.addEventListener("click", () => {
    selected = api;
    $("#detail-title").textContent = api.name;
    $("#detail-creator").textContent = `Built by ${api.creator}`;
    $("#detail-description").textContent = api.description;
    $("#detail-url").textContent = baseURL(api);
    $("#detail-demo-note").hidden = !demo;
    $("#detail").showModal();
  });
  return button;
}
function render() {
  const source = demo ? samples : apis;
  const query = $("#search").value.trim().toLowerCase();
  const sort = $("#sort").value;
  const filtered = source
    .filter((api) =>
      [api.name, api.creator, api.description, api.ip, String(api.port)].some(
        (v) => v.toLowerCase().includes(query),
      ),
    )
    .sort((a, b) =>
      sort === "newest"
        ? b.created_at.localeCompare(a.created_at)
        : a[sort].localeCompare(b[sort]),
    );
  $("#count").textContent = query
    ? `${filtered.length} / ${source.length}`
    : String(source.length);
  $("#api-list").replaceChildren(...filtered.map(card));
  $("#empty").hidden = !!source.length || (!demo && !lastGood);
  $("#no-results").hidden = !source.length || !!filtered.length;
  $("#demo-notice").hidden = !demo;
  if (demo)
    $("#freshness").textContent = "A few ideas for what you could build.";
  else if (lastGood)
    $("#freshness").textContent =
      `Updated ${lastGood.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Refreshes every 10 seconds`;
}
async function refresh() {
  if (loading || demo) return;
  loading = true;
  $("#refresh").disabled = true;
  try {
    const response = await fetch("/api/apis", {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Request failed");
    const data = await response.json();
    if (!Array.isArray(data.apis)) throw new Error("Invalid directory");
    apis = data.apis;
    lastGood = new Date();
    $("#error").hidden = true;
    render();
  } catch {
    $("#error").textContent =
      "Couldn’t refresh the directory. Check your connection and press Refresh to retry.";
    $("#error").hidden = false;
    $("#freshness").textContent = lastGood
      ? `Last updated ${lastGood.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Connection lost`
      : "The directory is unavailable.";
  } finally {
    loading = false;
    $("#refresh").disabled = false;
  }
}
for (const button of document.querySelectorAll("[data-guide]"))
  button.addEventListener("click", () => $("#guide").showModal());
for (const button of document.querySelectorAll(".close"))
  button.addEventListener("click", () => button.closest("dialog").close());
for (const dialog of document.querySelectorAll("dialog"))
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      dialog.close();
  });
$("#register-url").textContent = `${location.origin}/api/apis`;
$("#registration-json").textContent = JSON.stringify(example, null, 2);
$("#copy-register").addEventListener("click", () =>
  copy(`${location.origin}/api/apis`),
);
$("#copy-json").addEventListener("click", () =>
  copy(JSON.stringify(example, null, 2)),
);
$("#copy-detail").addEventListener("click", () => copy(baseURL(selected)));
$("#search").addEventListener("input", render);
$("#sort").addEventListener("change", render);
$("#refresh").addEventListener("click", () => {
  if (demo) toast("Example directory · Switch back to see the room.");
  else refresh();
});
$("#show-demo").addEventListener("click", () => {
  demo = true;
  $("#error").hidden = true;
  render();
});
$("#leave-demo").addEventListener("click", () => {
  demo = false;
  $("#search").value = "";
  render();
  refresh();
});
$(".acm-logo").addEventListener("error", (event) => {
  event.target.hidden = true;
});
if ($(".acm-logo").complete && !$(".acm-logo").naturalWidth)
  $(".acm-logo").hidden = true;
render();
refresh();
setInterval(() => {
  if (!document.hidden) refresh();
}, 10000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refresh();
});
