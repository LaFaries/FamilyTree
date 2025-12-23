// ========= CONFIG =========
const ENDPOINTS = {
  getShared: "/.netlify/functions/getSharedTree",
  uploadShared: "/.netlify/functions/uploadTree",
};

const LOCAL_KEY = "lafaries_family_tree_v1";

// ========= ELEMENTS =========
const $ = (id) => document.getElementById(id);

const fileInput = $("fileInput");
const btnPreview = $("btnPreview");

const previewCard = $("previewCard");
const countsEl = $("counts");
const sampleEl = $("sample");

const btnUploadShared = $("btnUploadShared");
const btnSaveLocal = $("btnSaveLocal");
const btnCancelPreview = $("btnCancelPreview");

const btnLoadShared = $("btnLoadShared");
const btnLoadLocal = $("btnLoadLocal");
const btnClearLocal = $("btnClearLocal");

const treeSourcePill = $("treeSourcePill");
const statPeople = $("statPeople");
const statFamilies = $("statFamilies");
const statSurnames = $("statSurnames");

const btnExportJson = $("btnExportJson");
const btnExportCsv = $("btnExportCsv");
const btnClearLoaded = $("btnClearLoaded");

const toast = $("toast");

const step1 = $("step1");
const step2 = $("step2");
const step3 = $("step3");

const helpDialog = $("helpDialog");
const btnHelp = $("btnHelp");
const btnCloseHelp = $("btnCloseHelp");

const confirmDialog = $("confirmDialog");
const confirmTitle = $("confirmTitle");
const confirmText = $("confirmText");
const confirmCancel = $("confirmCancel");
const confirmOk = $("confirmOk");

// ========= STATE =========
let parsedTree = null;      // { title, people, families? }
let loadedTree = null;      // current active tree in app
let loadedSource = null;    // "shared" | "local" | "uploadPreview"

// ========= TOAST =========
function showToast(message, ms = 2600) {
  toast.textContent = message;
  toast.hidden = false;
  setTimeout(() => (toast.hidden = true), ms);
}

// ========= CONFIRM =========
function confirmAction(title, text) {
  return new Promise((resolve) => {
    confirmTitle.textContent = title;
    confirmText.textContent = text;

    const cleanup = () => {
      confirmCancel.onclick = null;
      confirmOk.onclick = null;
      confirmDialog.close();
    };

    confirmCancel.onclick = () => { cleanup(); resolve(false); };
    confirmOk.onclick = () => { cleanup(); resolve(true); };

    confirmDialog.showModal();
  });
}

// ========= GEDCOM PARSER (simple + resilient) =========
// Converts GEDCOM into a basic JSON model: people + families.
// This is intentionally forgiving for beginner usage.
function parseGedcom(text) {
  const lines = text.split(/\r?\n/);
  const people = [];
  const families = [];

  let current = null;
  let currentType = null;

  function commit() {
    if (!current) return;
    if (currentType === "INDI") people.push(current);
    if (currentType === "FAM") families.push(current);
    current = null;
    currentType = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const m = line.match(/^(\d+)\s+(@[^@]+@)?\s*([A-Z0-9_]+)\s*(.*)$/);
    if (!m) continue;

    const level = Number(m[1]);
    const xref = m[2] || "";
    const tag = m[3];
    const rest = (m[4] || "").trim();

    // start records
    if (level === 0 && rest === "INDI") {
      commit();
      currentType = "INDI";
      current = {
        id: xref,
        name: "",
        sex: "",
        birt: { date: "", place: "" },
        deat: { date: "", place: "" },
        famc: [],
        fams: [],
      };
      continue;
    }
    if (level === 0 && rest === "FAM") {
      commit();
      currentType = "FAM";
      current = {
        id: xref,
        husb: "",
        wife: "",
        chil: [],
        marr: { date: "", place: "" },
      };
      continue;
    }
    if (level === 0 && tag === "TRLR") {
      commit();
      break;
    }

    if (!current) continue;

    // INDIVIDUAL fields
    if (currentType === "INDI") {
      if (tag === "NAME") {
        current.name = rest.replace(/\//g, "").trim();
      } else if (tag === "SEX") {
        current.sex = rest;
      } else if (tag === "FAMC") {
        current.famc.push(rest);
      } else if (tag === "FAMS") {
        current.fams.push(rest);
      } else if (tag === "BIRT") {
        current.__inBIRT = true; current.__inDEAT = false;
      } else if (tag === "DEAT") {
        current.__inDEAT = true; current.__inBIRT = false;
      } else if (tag === "DATE") {
        if (current.__inBIRT) current.birt.date = rest;
        if (current.__inDEAT) current.deat.date = rest;
      } else if (tag === "PLAC") {
        if (current.__inBIRT) current.birt.place = rest;
        if (current.__inDEAT) current.deat.place = rest;
      }
    }

    // FAMILY fields
    if (currentType === "FAM") {
      if (tag === "HUSB") current.husb = rest;
      else if (tag === "WIFE") current.wife = rest;
      else if (tag === "CHIL") current.chil.push(rest);
      else if (tag === "MARR") current.__inMARR = true;
      else if (tag === "DATE" && current.__inMARR) current.marr.date = rest;
      else if (tag === "PLAC" && current.__inMARR) current.marr.place = rest;
    }
  }

  commit();

  // Surname list
  const surnames = new Set();
  for (const p of people) {
    const parts = (p.name || "").split(" ").filter(Boolean);
    if (parts.length) surnames.add(parts[parts.length - 1].toLowerCase());
  }

  return {
    title: "Interactive Family Tree",
    people,
    families,
    stats: {
      people: people.length,
      families: families.length,
      surnames: surnames.size,
    },
  };
}

// ========= UI HELPERS =========
function setStepDone(stepEl, done) {
  stepEl.classList.toggle("done", !!done);
}
function setLoadedTree(tree, sourceLabel) {
  loadedTree = tree;
  loadedSource = sourceLabel;

  $("treeSourcePill").textContent =
    sourceLabel === "shared" ? "Loaded: Shared (Cloud)"
    : sourceLabel === "local" ? "Loaded: My Saved (Device)"
    : sourceLabel === "uploadPreview" ? "Loaded: Preview"
    : "Loaded";

  $("statPeople").textContent = tree?.stats?.people ?? "—";
  $("statFamilies").textContent = tree?.stats?.families ?? "—";
  $("statSurnames").textContent = tree?.stats?.surnames ?? "—";

  const hasTree = !!tree;
  btnExportJson.disabled = !hasTree;
  btnExportCsv.disabled = !hasTree;
  btnClearLoaded.disabled = !hasTree;
}

// ========= EXPORTS =========
function downloadFile(filename, content, mime = "application/json") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCsv(tree) {
  const header = ["id","name","sex","birt_date","birt_place","deat_date","deat_place"];
  const rows = [header];

  for (const p of tree.people || []) {
    rows.push([
      p.id || "",
      (p.name || "").replaceAll('"', '""'),
      p.sex || "",
      p.birt?.date || "",
      (p.birt?.place || "").replaceAll('"', '""'),
      p.deat?.date || "",
      (p.deat?.place || "").replaceAll('"', '""'),
    ]);
  }

  return rows.map(r => r.map(v => `"${String(v)}"`).join(",")).join("\n");
}

// ========= NETWORK =========
async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }

  if (!res.ok) {
    const msg = json?.error || json?.message || text || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

// ========= EVENTS =========
btnHelp.addEventListener("click", () => helpDialog.showModal());
btnCloseHelp.addEventListener("click", () => helpDialog.close());

// Step 1: select file
fileInput.addEventListener("change", () => {
  const hasFile = fileInput.files && fileInput.files.length > 0;
  btnPreview.disabled = !hasFile;

  setStepDone(step1, hasFile);
  setStepDone(step2, false);
  setStepDone(step3, false);

  previewCard.hidden = true;
  parsedTree = null;
});

// Step 2: preview
btnPreview.addEventListener("click", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  showToast("Reading file…");
  const text = await file.text();

  // Parse
  try {
    parsedTree = parseGedcom(text);
  } catch (e) {
    console.error(e);
    showToast("Could not parse this GEDCOM. Try exporting again.");
    return;
  }

  // Preview UI
  countsEl.innerHTML = `
    <div><strong>People:</strong> ${parsedTree.stats.people}</div>
    <div><strong>Families:</strong> ${parsedTree.stats.families}</div>
    <div><strong>Surnames:</strong> ${parsedTree.stats.surnames}</div>
  `;

  const sample = (parsedTree.people || []).slice(0, 6).map(p => ({
    id: p.id, name: p.name, birt: p.birt, deat: p.deat
  }));
  sampleEl.textContent = JSON.stringify(sample, null, 2);

  previewCard.hidden = false;
  btnUploadShared.disabled = false;
  btnSaveLocal.disabled = false;

  setStepDone(step2, true);
  setLoadedTree(parsedTree, "uploadPreview");

  showToast("Preview ready. If it looks correct, save or share.");
});

btnCancelPreview.addEventListener("click", () => {
  previewCard.hidden = true;
  btnUploadShared.disabled = true;
  btnSaveLocal.disabled = true;
  parsedTree = null;
  setStepDone(step2, false);
  showToast("Preview canceled.");
});

// Step 3: save local
btnSaveLocal.addEventListener("click", async () => {
  if (!parsedTree) return;

  const ok = await confirmAction(
    "Save to this device?",
    "This will save the tree in your browser on this computer only."
  );
  if (!ok) return;

  localStorage.setItem(LOCAL_KEY, JSON.stringify(parsedTree));
  setStepDone(step3, true);
  showToast("Saved to this device.");
});

// Step 3: upload shared (cloud)
btnUploadShared.addEventListener("click", async () => {
  if (!parsedTree) return;

  const ok = await confirmAction(
    "Update the Shared Tree (Cloud)?",
    "This will replace the shared cloud copy for everyone who loads it."
  );
  if (!ok) return;

  btnUploadShared.disabled = true;
  showToast("Uploading to cloud…");

  try {
    const body = JSON.stringify({
      id: 1,
      data: parsedTree
    });

    await fetchJson(ENDPOINTS.uploadShared, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });

    setStepDone(step3, true);
    showToast("Shared tree updated successfully.");
  } catch (e) {
    console.error(e);
    showToast(`Upload failed: ${e.message}`);
  } finally {
    btnUploadShared.disabled = false;
  }
});

// Load shared
btnLoadShared.addEventListener("click", async () => {
  showToast("Loading shared tree…");
  try {
    const json = await fetchJson(ENDPOINTS.getShared);
    if (!json?.data) {
      showToast("Shared tree is empty. Upload one first.");
      return;
    }
    setLoadedTree(json.data, "shared");
    showToast("Shared tree loaded.");
  } catch (e) {
    console.error(e);
    showToast(`Could not load shared tree: ${e.message}`);
  }
});

// Load local
btnLoadLocal.addEventListener("click", () => {
  const raw = localStorage.getItem(LOCAL_KEY);
  if (!raw) {
    showToast("No saved tree found on this device.");
    return;
  }
  try {
    const tree = JSON.parse(raw);
    setLoadedTree(tree, "local");
    showToast("Loaded your saved tree.");
  } catch {
    showToast("Your saved tree is corrupted. Clear it and save again.");
  }
});

// Clear local
btnClearLocal.addEventListener("click", async () => {
  const ok = await confirmAction(
    "Clear your saved copy?",
    "This removes only the device copy (it does not affect the shared cloud tree)."
  );
  if (!ok) return;

  localStorage.removeItem(LOCAL_KEY);
  showToast("Saved copy cleared.");
});

// Export JSON
btnExportJson.addEventListener("click", () => {
  if (!loadedTree) return;
  downloadFile("family-tree.json", JSON.stringify(loadedTree, null, 2), "application/json");
});

// Export CSV
btnExportCsv.addEventListener("click", () => {
  if (!loadedTree) return;
  downloadFile("family-tree-people.csv", toCsv(loadedTree), "text/csv");
});

// Clear loaded
btnClearLoaded.addEventListener("click", async () => {
  const ok = await confirmAction(
    "Clear loaded tree from screen?",
    "This only clears the current view (it does not delete cloud or device data)."
  );
  if (!ok) return;

  setLoadedTree(null, null);
  treeSourcePill.textContent = "Not loaded";
  showToast("Cleared current view.");
});

// initial
setLoadedTree(null, null);

