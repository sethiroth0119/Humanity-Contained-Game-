/* ============================================================
   Character Creator — trait + past-life selection.
   Two-tab modal shown from the splash screen (and re-openable
   from in-game with K). Characters in the final game are 3D
   models in Godot, so there's no in-prototype sprite editor.
   ============================================================ */

(function () {

const root = document.getElementById('creator');
const tabsEl = root.querySelector('.creator-tabs');
const bodyEl = root.querySelector('.creator-body');
const footerEl = root.querySelector('.creator-footer');

let currentTab = 'traits';
let selectedTraits = TRAITS.load() || [];

// ----- Open / close -----
function open(tab) {
  currentTab = tab || currentTab;
  root.classList.add('show');
  render();
}
function close() {
  root.classList.remove('show');
}
root.querySelector('.creator-close').addEventListener('click', close);
root.addEventListener('click', (e) => { if (e.target === root) close(); });

// ----- Render entire panel -----
function render() {
  // Tabs
  tabsEl.innerHTML = `
    <button class="creator-tab ${currentTab==='traits' ? 'active':''}" data-tab="traits">Traits</button>
    <button class="creator-tab ${currentTab==='past_life' ? 'active':''}" data-tab="past_life">Past Life</button>
  `;
  tabsEl.querySelectorAll('.creator-tab').forEach(b => {
    b.onclick = () => { currentTab = b.dataset.tab; render(); };
  });

  if (currentTab === 'traits') renderTraits();
  else renderPastLife();
}

/* ==================================================
   TRAITS TAB
   ================================================== */
function renderTraits() {
  const good = Object.entries(TRAITS.DEFS).filter(([id, t]) => t.type === 'good');
  const bad  = Object.entries(TRAITS.DEFS).filter(([id, t]) => t.type === 'bad');

  bodyEl.innerHTML = `
    <div class="trait-intro">
      <p>Pick your traits. Good traits cost points; bad traits give them back. Your selection must balance to <strong>zero or above</strong> before you step out.</p>
    </div>
    <div class="trait-grid">
      <div class="trait-col">
        <h3>Good <span class="hint">— costs points</span></h3>
        ${good.map(([id, t]) => traitCard(id, t)).join('')}
      </div>
      <div class="trait-col">
        <h3>Bad <span class="hint">— grants points</span></h3>
        ${bad.map(([id, t]) => traitCard(id, t)).join('')}
      </div>
    </div>
  `;
  bodyEl.querySelectorAll('.trait-card').forEach(c => {
    c.addEventListener('click', () => {
      const id = c.dataset.id;
      if (selectedTraits.includes(id)) {
        selectedTraits = selectedTraits.filter(t => t !== id);
      } else {
        selectedTraits.push(id);
      }
      TRAITS.save(selectedTraits);
      renderTraits();
      renderFooterForTraits();
    });
  });
  renderFooterForTraits();
}

function traitCard(id, t) {
  const sel = selectedTraits.includes(id);
  const sign = t.cost > 0 ? `+${t.cost}` : `${t.cost}`;
  return `
    <div class="trait-card ${sel ? 'selected' : ''} ${t.type}" data-id="${id}">
      <div class="trait-head">
        <span class="trait-name">${t.name}</span>
        <span class="trait-cost">${sign}</span>
      </div>
      <div class="trait-desc">${t.desc}</div>
    </div>
  `;
}

function renderFooterForTraits() {
  const cost = TRAITS.totalCost(selectedTraits);
  const ok = cost <= 0;
  footerEl.innerHTML = `
    <div class="cost-meter ${ok ? 'ok' : 'bad'}">
      <span class="label">Balance</span>
      <span class="val">${cost > 0 ? '+' : ''}${cost}</span>
      <span class="hint">${ok ? 'Acceptable. Step out when ready.' : 'You owe the veil. Add bad traits or drop good ones.'}</span>
    </div>
    <div class="creator-actions">
      <button class="ghost" id="reset-traits">Reset</button>
      <button class="primary" id="save-traits" ${ok ? '' : 'disabled'}>Confirm & close</button>
    </div>
  `;
  document.getElementById('reset-traits').onclick = () => {
    selectedTraits = [];
    TRAITS.save(selectedTraits);
    renderTraits();
  };
  document.getElementById('save-traits').onclick = () => {
    if (!ok) return;
    close();
  };
}

/* ==================================================
   PAST LIFE TAB
   ================================================== */
let selectedJob = JOBS.load();

function renderPastLife() {
  bodyEl.innerHTML = `
    <div class="trait-intro">
      <p>Pick what you were <em>before</em>. Each life leaves its mark — a different opening kit, different reflexes, different blind spots.</p>
    </div>
    <div class="job-grid">
      ${JOBS.ORDER.map(id => jobCard(id, JOBS.DEFS[id])).join('')}
    </div>
  `;
  bodyEl.querySelectorAll('.job-card').forEach(c => {
    c.addEventListener('click', () => {
      selectedJob = c.dataset.id;
      JOBS.save(selectedJob);
      renderPastLife();
      renderFooterForJobs();
    });
  });
  renderFooterForJobs();
}

function jobCard(id, j) {
  const sel = selectedJob === id;
  const starter = j.starter.map(s => `${itemDef(s.item).name}${s.qty > 1 ? ' ×' + s.qty : ''}`).join(', ');
  return `
    <div class="job-card ${sel ? 'selected' : ''}" data-id="${id}">
      <div class="job-head">
        <span class="job-name">${j.name}</span>
        ${sel ? '<span class="job-sel">SELECTED</span>' : ''}
      </div>
      <div class="job-tag">${j.tagline}</div>
      <div class="job-era">${j.era}</div>
      <div class="job-starter">
        <span class="lbl">Carries</span>
        <span class="val">${starter}</span>
      </div>
      <div class="job-effects">
        ${j.perks.map(p => `<div class="perk">+ ${p}</div>`).join('')}
        ${j.drawbacks.map(p => `<div class="drawback">− ${p}</div>`).join('')}
      </div>
    </div>
  `;
}

function renderFooterForJobs() {
  const j = JOBS.DEFS[selectedJob];
  footerEl.innerHTML = `
    <div class="cost-meter ok">
      <span class="label">Past life</span>
      <span class="val" style="font-size:16px">${j.name}</span>
      <span class="hint">${j.tagline}</span>
    </div>
    <div class="creator-actions">
      <button class="primary" id="save-job">Confirm & close</button>
    </div>
  `;
  document.getElementById('save-job').onclick = close;
}

// ----- Expose -----
window.CREATOR = { open, close, render };

})();
