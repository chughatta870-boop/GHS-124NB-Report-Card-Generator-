/* ---------------------------------------------------------
   Report Card System — KG to Class 8
   Pure vanilla JS, localStorage-backed, offline-first PWA
--------------------------------------------------------- */

const STORAGE_KEY = "rc_data_v1";

const DEFAULT_CLASSES = ["Kachi","Class 1","Class 2","Class 3","Class 4","Class 5","Class 6","Class 7","Class 8"];

let state = loadState();
let editingStudentId = null;

/* ---------------- storage ---------------- */

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){ console.warn("Could not read saved data", e); }

  const classes = {};
  DEFAULT_CLASSES.forEach(c => { classes[c] = { subjects: [], students: [] }; });
  return { schoolName: "Your School Name", classes, activeClass: DEFAULT_CLASSES[0] };
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  flashSaveStatus();
}

function flashSaveStatus(){
  const el = document.getElementById("saveStatus");
  el.textContent = "Saved just now";
  el.style.opacity = "1";
  clearTimeout(flashSaveStatus._t);
  flashSaveStatus._t = setTimeout(() => { el.textContent = "All changes saved"; }, 1500);
}

function activeClassData(){
  if(!state.classes[state.activeClass]){
    state.activeClass = Object.keys(state.classes)[0];
  }
  return state.classes[state.activeClass];
}

/* ---------------- toast ---------------- */

function toast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------------- calculations ---------------- */

function computeResults(cls){
  const subjects = cls.subjects;
  const totalMarks = subjects.reduce((s, sub) => s + Number(sub.max || 0), 0);

  const rows = cls.students.map(st => {
    let obtained = 0;
    subjects.forEach(sub => { obtained += Number(st.marks[sub.name] || 0); });
    const percentage = totalMarks > 0 ? (obtained / totalMarks) * 100 : 0;
    let status = "fail";
    if(percentage >= 33) status = "pass";
    else if(percentage >= 25) status = "promote";
    return { ...st, obtained, totalMarks, percentage, status };
  });

  // competition ranking (1,2,2,4) by obtained marks desc
  const sorted = [...rows].sort((a,b) => b.obtained - a.obtained);
  let lastMarks = null, lastRank = 0;
  sorted.forEach((row, idx) => {
    if(row.obtained !== lastMarks){
      lastRank = idx + 1;
      lastMarks = row.obtained;
    }
    row.position = lastRank;
  });
  const posMap = {};
  sorted.forEach(r => posMap[r.id] = r.position);
  rows.forEach(r => r.position = posMap[r.id]);

  // keep original insertion order for table display
  return rows;
}

function statusLabel(s){
  if(s === "pass") return "Pass";
  if(s === "promote") return "Promote";
  return "Fail";
}

/* ---------------- rendering: class select ---------------- */

function renderClassSelect(){
  const sel = document.getElementById("classSelect");
  sel.innerHTML = "";
  Object.keys(state.classes).forEach(cname => {
    const opt = document.createElement("option");
    opt.value = cname;
    opt.textContent = cname;
    if(cname === state.activeClass) opt.selected = true;
    sel.appendChild(opt);
  });
}

/* ---------------- rendering: subjects ---------------- */

function renderSubjectTags(){
  const wrap = document.getElementById("subjectTags");
  const cls = activeClassData();
  wrap.innerHTML = "";
  if(cls.subjects.length === 0){
    const span = document.createElement("span");
    span.style.color = "var(--muted)";
    span.style.fontFamily = '"Helvetica Neue",Arial,sans-serif';
    span.style.fontSize = ".8rem";
    span.textContent = "No subjects yet — add subjects below before entering results.";
    wrap.appendChild(span);
    return;
  }
  cls.subjects.forEach(sub => {
    const tag = document.createElement("div");
    tag.className = "subject-tag";
    tag.innerHTML = `<span>${escapeHtml(sub.name)} (${sub.max})</span>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "×";
    btn.title = "Remove subject";
    btn.addEventListener("click", () => removeSubject(sub.name));
    tag.appendChild(btn);
    wrap.appendChild(tag);
  });
}

function removeSubject(name){
  if(!confirm(`Remove subject "${name}"? This will also remove its marks from all students in this class.`)) return;
  const cls = activeClassData();
  cls.subjects = cls.subjects.filter(s => s.name !== name);
  cls.students.forEach(st => { delete st.marks[name]; });
  saveState();
  renderSubjectTags();
  renderMarksInputs();
  renderTable();
}

/* ---------------- rendering: marks inputs on the form ---------------- */

function renderMarksInputs(){
  const wrap = document.getElementById("marksInputs");
  const cls = activeClassData();
  wrap.innerHTML = "";
  cls.subjects.forEach(sub => {
    const field = document.createElement("div");
    field.className = "field";
    const id = "marks_" + sanitizeId(sub.name);
    field.innerHTML = `<label for="${id}">${escapeHtml(sub.name)} (/${sub.max})</label>
      <input type="number" id="${id}" data-subject="${escapeAttr(sub.name)}" min="0" max="${sub.max}" placeholder="0">`;
    wrap.appendChild(field);
  });
}

/* ---------------- rendering: results table ---------------- */

function renderTable(){
  const wrap = document.getElementById("resultTableWrap");
  const cls = activeClassData();

  if(cls.subjects.length === 0){
    wrap.innerHTML = `<div class="empty-state">Add subjects first, then enter student marks.</div>`;
    return;
  }
  if(cls.students.length === 0){
    wrap.innerHTML = `<div class="empty-state">No students added yet for this class.</div>`;
    return;
  }

  const results = computeResults(cls);

  let html = `<div style="overflow-x:auto;"><table><thead><tr>
    <th>Roll No.</th><th>Name</th>`;
  cls.subjects.forEach(sub => { html += `<th>${escapeHtml(sub.name)}</th>`; });
  html += `<th>Obtained</th><th>Total</th><th>%age</th><th>Position</th><th>Status</th><th class="no-print">Actions</th>
    </tr></thead><tbody>`;

  results.forEach(r => {
    html += `<tr>
      <td>${escapeHtml(r.roll)}</td>
      <td>${escapeHtml(r.name)}</td>`;
    cls.subjects.forEach(sub => {
      html += `<td>${r.marks[sub.name] !== undefined ? r.marks[sub.name] : "-"}</td>`;
    });
    html += `<td><strong>${r.obtained}</strong></td>
      <td>${r.totalMarks}</td>
      <td>${r.percentage.toFixed(2)}%</td>
      <td class="pos">${r.position}</td>
      <td><span class="badge ${r.status}">${statusLabel(r.status)}</span></td>
      <td class="no-print">
        <div class="actions-row">
          <button class="icon-btn" title="View report card" onclick="viewReportCard('${r.id}')">🪪</button>
          <button class="icon-btn edit" title="Edit" onclick="editStudent('${r.id}')">✎</button>
          <button class="icon-btn del" title="Delete" onclick="deleteStudent('${r.id}')">🗑</button>
        </div>
      </td>
    </tr>`;
  });

  html += `</tbody></table></div>`;
  wrap.innerHTML = html;
}

/* ---------------- class management ---------------- */

function addClass(){
  const input = document.getElementById("newClassName");
  const name = input.value.trim();
  if(!name){ toast("Enter a class name first"); return; }
  if(state.classes[name]){ toast("That class already exists"); return; }
  state.classes[name] = { subjects: [], students: [] };
  state.activeClass = name;
  input.value = "";
  saveState();
  fullRender();
  toast(`Class "${name}" added`);
}

function deleteClass(){
  const names = Object.keys(state.classes);
  if(names.length <= 1){ toast("You must keep at least one class"); return; }
  if(!confirm(`Delete class "${state.activeClass}" and all its results? This cannot be undone.`)) return;
  delete state.classes[state.activeClass];
  state.activeClass = Object.keys(state.classes)[0];
  saveState();
  fullRender();
  toast("Class deleted");
}

/* ---------------- subject management ---------------- */

function addSubject(){
  const nameInput = document.getElementById("newSubjectName");
  const maxInput = document.getElementById("newSubjectMax");
  const name = nameInput.value.trim();
  const max = Number(maxInput.value) || 100;
  if(!name){ toast("Enter a subject name"); return; }
  const cls = activeClassData();
  if(cls.subjects.some(s => s.name.toLowerCase() === name.toLowerCase())){
    toast("Subject already exists"); return;
  }
  cls.subjects.push({ name, max });
  nameInput.value = "";
  maxInput.value = "100";
  saveState();
  renderSubjectTags();
  renderMarksInputs();
  renderTable();
  toast(`Subject "${name}" added`);
}

/* ---------------- student CRUD ---------------- */

function genId(){
  return "s_" + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

function handleStudentSubmit(e){
  e.preventDefault();
  const cls = activeClassData();
  if(cls.subjects.length === 0){ toast("Add subjects before adding students"); return; }

  const roll = document.getElementById("rollNo").value.trim();
  const name = document.getElementById("studentName").value.trim();
  if(!roll || !name){ toast("Roll number and name are required"); return; }

  const marks = {};
  document.querySelectorAll("#marksInputs input[data-subject]").forEach(inp => {
    const subName = inp.dataset.subject;
    const maxAllowed = cls.subjects.find(s => s.name === subName)?.max ?? 100;
    let val = Number(inp.value);
    if(isNaN(val) || val < 0) val = 0;
    if(val > maxAllowed) val = maxAllowed;
    marks[subName] = val;
  });

  if(editingStudentId){
    const st = cls.students.find(s => s.id === editingStudentId);
    if(st){ st.roll = roll; st.name = name; st.marks = marks; }
    toast("Student result updated");
  }else{
    cls.students.push({ id: genId(), roll, name, marks });
    toast("Student result saved");
  }

  editingStudentId = null;
  resetForm();
  saveState();
  renderTable();
}

function editStudent(id){
  const cls = activeClassData();
  const st = cls.students.find(s => s.id === id);
  if(!st) return;
  editingStudentId = id;
  document.getElementById("entryTitle").textContent = `Editing: ${st.name}`;
  document.getElementById("rollNo").value = st.roll;
  document.getElementById("studentName").value = st.name;
  document.querySelectorAll("#marksInputs input[data-subject]").forEach(inp => {
    inp.value = st.marks[inp.dataset.subject] ?? "";
  });
  document.getElementById("cancelEditBtn").style.display = "inline-block";
  document.getElementById("saveStudentBtn").textContent = "Update Student";
  document.getElementById("studentForm").scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelEdit(){
  editingStudentId = null;
  resetForm();
}

function resetForm(){
  document.getElementById("studentForm").reset();
  document.getElementById("entryTitle").textContent = "Step 2 — Add / Upload Student Result";
  document.getElementById("cancelEditBtn").style.display = "none";
  document.getElementById("saveStudentBtn").textContent = "Save Student";
}

function deleteStudent(id){
  const cls = activeClassData();
  const st = cls.students.find(s => s.id === id);
  if(!st) return;
  if(!confirm(`Delete result for "${st.name}" (Roll ${st.roll})? This cannot be undone.`)) return;
  cls.students = cls.students.filter(s => s.id !== id);
  if(editingStudentId === id){ editingStudentId = null; resetForm(); }
  saveState();
  renderTable();
  toast("Student result deleted");
}

/* ---------------- report card modal ---------------- */

function viewReportCard(id){
  const cls = activeClassData();
  const results = computeResults(cls);
  const r = results.find(x => x.id === id);
  if(!r) return;

  const rows = cls.subjects.map(sub => `
    <tr><td>${escapeHtml(sub.name)}</td><td>${sub.max}</td><td>${r.marks[sub.name] ?? 0}</td></tr>
  `).join("");

  const content = `
  <div class="report-card">
    <div class="rc-head">
      <p>${escapeHtml(state.schoolName)}</p>
      <h2>Report Card</h2>
      <p>Class: ${escapeHtml(state.activeClass)}</p>
    </div>
    <div class="rc-meta">
      <div><span>Student Name: </span><strong>${escapeHtml(r.name)}</strong></div>
      <div><span>Roll No.: </span><strong>${escapeHtml(r.roll)}</strong></div>
      <div><span>Class: </span><strong>${escapeHtml(state.activeClass)}</strong></div>
      <div><span>Position: </span><strong>${r.position}</strong></div>
    </div>
    <table class="rc-table">
      <thead><tr><th>Subject</th><th>Max Marks</th><th>Marks Obtained</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="rc-summary">
      <div><strong>${r.obtained}</strong>Obtained</div>
      <div><strong>${r.totalMarks}</strong>Total</div>
      <div><strong>${r.percentage.toFixed(2)}%</strong>Percentage</div>
      <div><strong>${r.position}</strong>Position</div>
      <div><strong style="text-transform:capitalize;">${statusLabel(r.status)}</strong>Result</div>
    </div>
    <div class="rc-sign">
      <div>Class Teacher</div>
      <div>Principal</div>
    </div>
  </div>`;

  document.getElementById("reportCardContent").innerHTML = content;
  document.getElementById("reportCardModal").style.display = "block";
}

function closeReportCard(){
  document.getElementById("reportCardModal").style.display = "none";
}

/* ---------------- CSV export ---------------- */

function exportCsv(){
  const cls = activeClassData();
  if(cls.students.length === 0){ toast("No students to export"); return; }
  const results = computeResults(cls);

  const headers = ["Roll No.","Name", ...cls.subjects.map(s => s.name), "Obtained","Total","Percentage","Position","Status"];
  const lines = [headers.join(",")];

  results.forEach(r => {
    const row = [
      csvSafe(r.roll), csvSafe(r.name),
      ...cls.subjects.map(s => r.marks[s.name] ?? 0),
      r.obtained, r.totalMarks, r.percentage.toFixed(2) + "%", r.position, statusLabel(r.status)
    ];
    lines.push(row.join(","));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${state.activeClass.replace(/\s+/g,"_")}_results.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast("CSV downloaded");
}

function csvSafe(val){
  const s = String(val ?? "");
  if(s.includes(",") || s.includes('"') || s.includes("\n")){
    return '"' + s.replace(/"/g,'""') + '"';
  }
  return s;
}

/* ---------------- helpers ---------------- */

function escapeHtml(str){
  return String(str ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}
function escapeAttr(str){ return escapeHtml(str); }
function sanitizeId(str){ return String(str).replace(/[^a-zA-Z0-9]/g, "_"); }

/* ---------------- full render / init ---------------- */

function fullRender(){
  renderClassSelect();
  renderSubjectTags();
  renderMarksInputs();
  renderTable();
}

function init(){
  document.getElementById("schoolName").value = state.schoolName;
  fullRender();

  document.getElementById("schoolName").addEventListener("input", e => {
    state.schoolName = e.target.value;
    saveState();
  });

  document.getElementById("classSelect").addEventListener("change", e => {
    state.activeClass = e.target.value;
    editingStudentId = null;
    resetForm();
    saveState();
    fullRender();
  });

  document.getElementById("addClassBtn").addEventListener("click", addClass);
  document.getElementById("deleteClassBtn").addEventListener("click", deleteClass);
  document.getElementById("addSubjectBtn").addEventListener("click", addSubject);
  document.getElementById("studentForm").addEventListener("submit", handleStudentSubmit);
  document.getElementById("cancelEditBtn").addEventListener("click", cancelEdit);
  document.getElementById("exportCsvBtn").addEventListener("click", exportCsv);
  document.getElementById("printSheetBtn").addEventListener("click", () => window.print());
  document.getElementById("closeCardBtn").addEventListener("click", closeReportCard);
  document.getElementById("printOneBtn").addEventListener("click", () => window.print());

  document.getElementById("reportCardModal").addEventListener("click", e => {
    if(e.target.id === "reportCardModal") closeReportCard();
  });
}

document.addEventListener("DOMContentLoaded", init);

/* ---------------- PWA service worker ---------------- */

if("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(err => {
      console.warn("Service worker registration failed:", err);
    });
  });
}
