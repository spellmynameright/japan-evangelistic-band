import { state } from './state.js';
import {
  ACTION_DEFS, allVisibleActions, actionUnlockCacheKey, hasFittingAction,
} from './actions.js';
import { LOCATION_DEFS, LOCATION_ORDER, travelCostTo } from './locations.js';
import { NPC_DEFS, getStageName, getTrustPercent, getStageAdvanceHint, getIntroText } from './npcs.js';
import { locText, actionText, actionDesc, langLevel } from './language.js';
import { playTap, startStationAmbience, stopStationAmbience } from './audio.js';
import { APP_VERSION, hardRefreshApp } from './version.js';
import { pickReflection } from './reflections.js';
import { getJournalEntries, markJournalRead, unreadJournalCount } from './journal.js';
import { dayBeat, weekdayFor } from './dayBeats.js';
import { getRecommendation } from './recommend.js';

// ─── DOM helpers ──────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

const PHASE_DISPLAY = {
  morning:    { icon: '☀️', en: 'Morning',    jp: '朝' },
  afternoon:  { icon: '🌤', en: 'Afternoon',  jp: '昼' },
  evening:    { icon: '🌙', en: 'Evening',    jp: '夜' },
  reflecting: { icon: '✨', en: 'Reflecting', jp: '振り返り' },
};

// ─── STATS BAR ────────────────────────────────────────────────────────────────
export function renderStatsBar() {
  const e = state.resources.energy;
  $('res-faith').textContent  = Math.floor(state.resources.faith.current);
  $('res-energy').textContent = `${e.current}/${e.max}`;
  $('res-wisdom').textContent = Math.floor(state.resources.wisdom);
  $('res-lang').textContent   = 'Lv.' + langLevel();
  $('res-money').textContent  = '¥' + Math.floor(state.resources.money.current);
}

// ─── DAY-BEAT HEADER (eyebrow + serif phrase + timeline + gear + spiritDry) ────
export function renderDayBeat() {
  const phase = state.time.phase;
  const d = PHASE_DISPLAY[phase] || PHASE_DISPLAY.morning;
  const weekday = weekdayFor(state.time.day);

  $('beat-eyebrow').textContent = `Day ${state.time.day} · ${weekday} ${d.en.toLowerCase()}`;

  const beat = dayBeat();
  $('beat-phrase-en').textContent = beat.phrase;
  $('beat-phrase-jp').textContent = beat.jp;

  $('beat-phase-name').textContent = d.en;
  const t = state.time;
  const tpct = t.max > 0 ? (t.remaining / t.max) * 100 : 0;
  $('beat-time-fill').style.width = tpct + '%';
  $('beat-time-count').textContent = `${t.remaining} of ${t.max} left`;

  // End-phase button + nudge
  const btn = $('end-phase-btn');
  const nudge = $('phase-nudge');
  const noFit = !hasFittingAction() && phase !== 'reflecting';
  if (btn) {
    btn.textContent = phase === 'reflecting' ? '…' : `End ${d.en} →`;
    btn.classList.toggle('warn', noFit);
  }
  if (nudge) nudge.classList.toggle('hidden', !noFit);

  // Spiritual-dryness indicator — surfaces only at ≥5.
  const sd = state.character?.spiritDry ?? 0;
  const indicator = $('header-spiritdry');
  if (indicator) {
    if (sd >= 5) {
      indicator.classList.remove('hidden');
      indicator.style.opacity = Math.min(1, 0.6 + (sd - 5) * 0.08).toFixed(2);
      indicator.setAttribute('title', `Spiritual dryness (${sd}/10) — pray, rest, or visit the onsen`);
    } else {
      indicator.classList.add('hidden');
    }
  }
}

// ─── SCENE (full-bleed image / video swap) ─────────────────────────────────────
let lastScene = null;
export function renderScene() {
  if (state.location === lastScene) return;
  lastScene = state.location;

  const def = LOCATION_DEFS[state.location] || LOCATION_DEFS.apartment;
  $('location-bg').className = 'location-bg ' + def.bgClass;

  const img = $('location-img');
  const vid = $('location-vid');

  if (state.location === 'station' && vid) {
    if (img) img.style.opacity = '0';
    vid.style.opacity = '1';
    if (vid.paused) vid.play().catch(() => {});
    startStationAmbience();
  } else {
    if (vid) {
      vid.style.opacity = '0';
      setTimeout(() => { if (!vid.paused) vid.pause(); }, 650);
    }
    stopStationAmbience();

    if (img) {
      const newSrc = `assets/images/locations/${def.id}.png`;
      const sameSrc = img.getAttribute('src') === newSrc;
      if (sameSrc) {
        img.style.opacity = (img.complete && img.naturalWidth > 0) ? '1' : '0';
      } else {
        img.style.opacity = '0';
        img.src = newSrc;
        img.onerror = () => { img.style.opacity = '0'; };
        img.onload  = () => { img.style.opacity = '1'; };
      }
    }
  }
}

// ─── "YOU ARE HERE" ANCHOR CARD ────────────────────────────────────────────────
let lastAnchorLoc = null;
export function renderAnchor() {
  if (state.location === lastAnchorLoc) return;
  lastAnchorLoc = state.location;

  const def = LOCATION_DEFS[state.location] || LOCATION_DEFS.apartment;
  const texts = locText(state.location);

  const anchor = $('location-anchor');
  if (anchor) anchor.style.setProperty('--acc', def.accent || '#FF8FAB');

  const thumb = $('anchor-thumb');
  if (thumb) thumb.style.backgroundImage = `url(assets/images/locations/${def.id}.png)`;

  $('location-name-en').textContent = texts.en;
  $('location-name-jp').textContent = texts.jp;
}

// ─── TRAVEL RAIL ───────────────────────────────────────────────────────────────
let lastRailKey = '';
export function invalidateTravelRail() { lastRailKey = ''; }

export function renderTravelRail() {
  const rail = $('travel-row');
  if (!rail) return;

  const t = state.time.remaining;
  const rec = getRecommendation();
  const recLoc = rec && rec.location !== state.location ? rec.location : '';
  const key = `${state.location}|${t}|${recLoc}`;
  if (key === lastRailKey) return;
  lastRailKey = key;

  rail.innerHTML = '';
  LOCATION_ORDER.forEach(locId => {
    const def  = LOCATION_DEFS[locId];
    const cur  = locId === state.location;
    const cost = travelCostTo(locId);
    const canAfford = cur || t >= cost;
    const isRec = !cur && locId === recLoc;

    const pill = el('button',
      'travel-pill' + (cur ? ' cur' : '') + (isRec ? ' rec' : '') + (canAfford ? '' : ' disabled-time'));
    pill.dataset.travelTo = locId;
    pill.innerHTML =
      `<span>${def.icon} ${def.short}</span>` +
      (isRec ? '<span class="star">★</span>' : '') +
      (cur ? '' : `<span class="c">⏳${cost}</span>`);
    if (!cur && !canAfford) pill.disabled = true;
    rail.appendChild(pill);
  });
}

export function bindTravelRail(onTravel) {
  const rail = $('travel-row');
  if (!rail) return;
  rail.addEventListener('click', e => {
    const pill = e.target.closest('.travel-pill');
    if (!pill || pill.disabled) return;
    const locId = pill.dataset.travelTo;
    if (locId && locId !== state.location) onTravel(locId);
  });
}

// ─── ACTION DOCK ───────────────────────────────────────────────────────────────
let lastDockKey = '';
export function renderDock(force = false) {
  const list = $('action-list');
  if (!list) return;

  const rec = getRecommendation();
  const here = state.location;
  const recId = rec && rec.location === here ? rec.actionId : null;
  const key = actionUnlockCacheKey() + '|rec:' + (recId || '');
  if (!force && key === lastDockKey) return;
  lastDockKey = key;

  // Dock header label + rec hint
  const d = PHASE_DISPLAY[state.time.phase] || PHASE_DISPLAY.morning;
  const lbl = $('dock-head-label');
  if (lbl) lbl.textContent = `What fits this ${d.en.toLowerCase()}`;
  const hint = $('dock-rec-hint');
  if (hint) hint.classList.toggle('hidden', !recId);

  list.innerHTML = '';

  const ids = allVisibleActions();
  if (ids.length === 0) {
    list.appendChild(el('div', 'empty-state', '<div class="empty-icon">🤫</div><p>Nothing to do here yet.</p>'));
    return;
  }

  // Sort: recommended first, then unlocked, then locked.
  ids.sort((a, b) => {
    if (a === recId) return -1;
    if (b === recId) return 1;
    const ua = ACTION_DEFS[a].unlocked() ? 0 : 1;
    const ub = ACTION_DEFS[b].unlocked() ? 0 : 1;
    return ua - ub;
  });

  ids.forEach(id => list.appendChild(buildDockCard(id, id === recId)));
}

function gainText(def) {
  const r = def.reward || {};
  const parts = [];
  if (r.faith)    parts.push('+Faith');
  if (r.wisdom)   parts.push('+Wisdom');
  if (typeof r.contacts === 'number' && r.contacts > 0) parts.push(`+${r.contacts} Contacts`);
  if (r.langXP)   parts.push('+Language');
  if (r.npcTrust) parts.push('+Trust');
  if (def.energyReward) parts.push('Recover energy');
  return parts.join(' · ');
}

function costText(def) {
  const c = def.cost || {};
  const parts = [];
  if (c.faith) parts.push(`−${c.faith} Faith`);
  if (c.money) parts.push(`−¥${c.money}`);
  if (c.wisdom) parts.push(`−${c.wisdom} Wisdom`);
  return parts.join(' · ');
}

function buildDockCard(id, isRec) {
  const def    = ACTION_DEFS[id];
  const texts  = actionText(id);
  const isLocked = !def.unlocked();
  const energy = state.resources.energy.current;
  const time   = state.time.remaining;
  const eCost  = def.energyCost ?? 0;
  const tCost  = def.timeCost ?? 0;
  const isDisabledEnergy = !isLocked && eCost > 0 && energy < eCost;
  const isDisabledTime   = !isLocked && tCost > 0 && time   < tCost;

  const card = el('div', [
    'dock-card',
    isRec            ? 'rec'             : '',
    isLocked         ? 'locked'          : '',
    isDisabledTime   ? 'disabled-time'   : '',
    isDisabledEnergy ? 'disabled-energy' : '',
  ].filter(Boolean).join(' '));
  card.dataset.actionId = id;

  if (isRec) card.appendChild(el('div', 'dock-card-tag', '★ Recommended'));
  card.appendChild(el('div', 'dock-card-ic', def.icon || '·'));
  card.appendChild(el('div', 'dock-card-name', texts.en));
  card.appendChild(el('div', 'dock-card-jp', texts.jp));

  const desc = actionDesc(id);
  if (desc) card.appendChild(el('div', 'dock-card-desc', desc));

  if (isLocked) {
    card.appendChild(el('div', 'dock-card-req', def.unlockHint || 'Locked for now'));
  } else {
    const meta = el('div', 'dock-card-meta');
    if (tCost > 0) meta.appendChild(el('span', 'dock-mp t', '⏳' + tCost));
    if (eCost > 0) meta.appendChild(el('span', 'dock-mp e', '⚡' + eCost));
    if (def.energyReward) meta.appendChild(el('span', 'dock-mp e', '+' + def.energyReward + '⚡'));
    const gain = gainText(def);
    if (gain) meta.appendChild(el('span', 'dock-mp g', gain));
    const cost = costText(def);
    if (cost) meta.appendChild(el('span', 'dock-mp c', cost));
    card.appendChild(meta);
  }

  return card;
}

export function flashActionCard(actionId) {
  const card = document.querySelector(`.dock-card[data-action-id="${actionId}"]`);
  if (!card) return;
  card.classList.remove('flash');
  void card.offsetWidth;
  card.classList.add('flash');
}

export function bindActionList(onAction) {
  $('action-list').addEventListener('click', e => {
    const card = e.target.closest('.dock-card');
    if (!card) return;
    if (card.classList.contains('locked')) return;
    if (card.classList.contains('disabled-energy')) return;
    if (card.classList.contains('disabled-time')) return;
    const id = card.dataset.actionId;
    if (id) onAction(id);
  });
}

export function bindEndPhase(onEndPhase) {
  $('end-phase-btn').addEventListener('click', () => {
    onEndPhase();
    playTap();
  });
}

// ─── PEOPLE OVERLAY ────────────────────────────────────────────────────────────
function moodDescriptor(mood) {
  if (mood >= 3)  return { icon: '🙂', word: 'Warm' };
  if (mood >= 1)  return { icon: '😊', word: 'Open' };
  if (mood <= -3) return { icon: '😔', word: 'Withdrawn' };
  if (mood < 0)   return { icon: '😕', word: 'Distant' };
  return { icon: '😐', word: 'Steady' };
}

function npcHome(id) {
  return ACTION_DEFS[`visit_${id}`]?.location || 'station';
}

function seenLabel(npc) {
  if (npc.lastSeenDay == null) return 'not yet';
  const ago = state.time.day - npc.lastSeenDay;
  if (ago <= 0) return 'today';
  return `${ago}d ago`;
}

export function renderPeople() {
  const list = $('people-list');
  if (!list) return;
  list.innerHTML = '';

  const top = $('contacts-top');
  if (top) {
    top.innerHTML = `<span class="ct-num">◈ ${state.resources.contacts}</span> contacts made · relationships in motion`;
  }

  const metNPCs = Object.entries(NPC_DEFS).filter(([id]) => state.npcs[id].met);
  if (metNPCs.length === 0) {
    list.appendChild(el('div', 'people-empty',
      '<div class="empty-icon">🌆</div>' +
      '<p>Tokyo is full of people.<br>Hand out tracts at the station,<br>or preach in the park.</p>'));
    return;
  }

  metNPCs.forEach(([id, def]) => {
    const npc = state.npcs[id];
    const card = el('div', [
      'person', def.cardClass,
      npc.stage >= 8 ? 'elder' : '',
    ].filter(Boolean).join(' '));

    // Row: avatar + name/role + stage block
    const row = el('div', 'person-row');
    row.appendChild(buildNpcAvatar(id, def, 'person-ava ' + def.cardClass));

    const idBlock = el('div', 'person-id');
    idBlock.appendChild(el('div', 'person-name', `${def.name} <span class="jp">${def.nameJP}</span>`));
    idBlock.appendChild(el('div', 'person-role', def.role));
    row.appendChild(idBlock);

    const md = moodDescriptor(npc.mood ?? 0);
    const stageBlock = el('div', 'person-stage');
    stageBlock.appendChild(el('div', 's', getStageName(id)));
    stageBlock.appendChild(el('div', 'm', `${md.icon} ${md.word}`));
    row.appendChild(stageBlock);
    card.appendChild(row);

    if (def.line) card.appendChild(el('div', 'person-line', `“${def.line}”`));

    // Trust meter
    const nextStage = def.stages[npc.stage + 1];
    const nextNeed  = def.trustNeeded[npc.stage + 1];
    const topRow = el('div', 'person-top',
      `<span>${nextStage ? 'Trust → ' + nextStage : 'Fully grown'}</span>` +
      `<span>${nextNeed ? Math.floor(npc.trust) + ' / ' + nextNeed : '—'}</span>`);
    card.appendChild(topRow);
    const track = el('div', 'person-track');
    track.appendChild(el('i', null)).style.width = getTrustPercent(id).toFixed(0) + '%';
    card.appendChild(track);

    const hint = getStageAdvanceHint(id);
    if (hint) card.appendChild(el('div', 'person-hint', hint));

    // Footer: location + last seen + Visit
    const home = npcHome(id);
    const homeDef = LOCATION_DEFS[home];
    const foot = el('div', 'person-foot');
    foot.appendChild(el('div', 'person-meta', `📍 ${homeDef.short} · seen ${seenLabel(npc)}`));
    const visit = el('button', 'person-visit', `Visit ${homeDef.icon}`);
    visit.dataset.npc = id;
    foot.appendChild(visit);
    card.appendChild(foot);

    list.appendChild(card);
  });
}

export function bindPeopleList(onVisit) {
  const list = $('people-list');
  if (!list) return;
  list.addEventListener('click', e => {
    const btn = e.target.closest('.person-visit');
    if (!btn) return;
    const npcId = btn.dataset.npc;
    if (npcId) onVisit(npcId);
  });
}

function buildNpcAvatar(npcId, def, className) {
  const wrap = el('div', className);
  const img = document.createElement('img');
  img.src       = `assets/images/npcs/${npcId}.png`;
  img.alt       = def.name;
  img.className = 'npc-portrait-img';
  img.onerror   = () => img.style.display = 'none';
  wrap.appendChild(img);
  wrap.appendChild(el('span', 'npc-portrait-fallback', def.nameJP[0]));
  return wrap;
}

// ─── JOURNAL OVERLAY ───────────────────────────────────────────────────────────
const JOURNAL_KIND = {
  milestone:   'Milestone',
  npcMeet:     'Relationship',
  stageAdvance:'Relationship',
  conversion:  'Conversion',
  langLevelUp: 'Milestone',
  setback:     'Setback',
};

export function renderJournal() {
  const list = $('journal-list');
  if (!list) return;
  list.innerHTML = '';

  const entries = getJournalEntries();
  if (entries.length === 0) {
    list.appendChild(el('div', 'journal-empty',
      `<div class="empty-icon">📖</div>
       <p>Your journal is empty.</p>
       <p class="journal-empty-sub">Important moments will be recorded here as you live them.</p>`));
    return;
  }

  // Entries are newest-first; the first `unread` of them are the fresh ones.
  const unread = unreadJournalCount();
  entries.forEach((entry, i) => {
    const card = el('div', 'jcard');
    card.dataset.entryId = entry.id;
    const kind = JOURNAL_KIND[entry.type] || 'Note';
    card.innerHTML = `
      <div class="jcard-top">
        <span class="jcard-ic">${entry.icon || '·'}</span>
        <span class="jcard-kind">${kind}</span>
        ${i < unread ? '<span class="jcard-dot"></span>' : ''}
        <span class="jcard-day">Day ${entry.day}</span>
      </div>
      <div class="jcard-title">${entry.title}</div>
      <div class="jcard-body">${entry.body || ''}</div>
    `;
    list.appendChild(card);
  });
}

// ─── VIEW SWITCHING (segmented nav) ────────────────────────────────────────────
let currentView = 'scene';

export function setView(tab) {
  const mode = tab === 'actions' ? 'scene' : tab;   // nav tab 'actions' → 'scene' mode
  currentView = mode;
  const gs = $('game-screen');
  gs.classList.remove('mode-scene', 'mode-people', 'mode-journal');
  gs.classList.add('mode-' + mode);

  $('tab-people').classList.toggle('hidden', tab !== 'people');
  $('tab-journal').classList.toggle('hidden', tab !== 'journal');

  document.querySelectorAll('.seg-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));

  if (tab === 'people')  renderPeople();
  if (tab === 'journal') { renderJournal(); markJournalRead(); updateNavBadge(true); }
}

export function bindNav() {
  document.querySelectorAll('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setView(btn.dataset.tab);
      playTap();
    });
  });
}

// Journal unread badge on the nav label.
let lastNavUnread = -1;
export function updateNavBadge(force = false) {
  const unread = unreadJournalCount();
  if (!force && unread === lastNavUnread) return;
  lastNavUnread = unread;
  const lbl = document.querySelector('.seg-btn[data-tab="journal"] .seg-lbl');
  if (lbl) lbl.textContent = unread > 0 ? `Journal (${unread})` : 'Journal';
}

// ─── TOAST ─────────────────────────────────────────────────────────────────────
let toastTimer = null;
let toastOnDismiss = null;

export function showToast(icon, title, desc = '', onDismiss = null) {
  const toast = $('toast');
  $('toast-icon').textContent  = icon;
  $('toast-title').textContent = title;
  $('toast-desc').textContent  = desc;

  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastOnDismiss = onDismiss;
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    const cb = toastOnDismiss;
    toastOnDismiss = null;
    if (cb) cb();
  }, 2800);
}

// ─── NPC STATE SHIFT CARD ───────────────────────────────────────────────────────
let npcStateTimer = null;
let npcStateOnDismiss = null;

export function showNpcStateCard(npcId, headline, desc = '', onDismiss = null) {
  const def = NPC_DEFS[npcId];
  if (!def) { if (onDismiss) onDismiss(); return; }

  const card = $('npc-state-card');
  const portrait = $('npc-state-portrait');
  portrait.className = 'npc-state-portrait ' + (def.portraitClass || '');
  portrait.innerHTML = '';
  const img = document.createElement('img');
  img.src       = `assets/images/npcs/${npcId}.png`;
  img.alt       = def.name;
  img.className = 'npc-portrait-img';
  img.onerror   = () => { img.style.display = 'none'; };
  portrait.appendChild(img);
  portrait.appendChild(el('span', 'npc-portrait-fallback', def.nameJP[0]));

  $('npc-state-name').textContent     = def.name;
  $('npc-state-headline').textContent = headline;
  $('npc-state-desc').textContent     = desc;

  card.classList.remove('hidden');
  void card.offsetWidth;
  card.classList.add('show');

  if (npcStateTimer) clearTimeout(npcStateTimer);
  npcStateOnDismiss = onDismiss;
  npcStateTimer = setTimeout(() => {
    card.classList.remove('show');
    setTimeout(() => card.classList.add('hidden'), 380);
    const cb = npcStateOnDismiss;
    npcStateOnDismiss = null;
    if (cb) cb();
  }, 3600);
}

// ─── STORY POPUP ─────────────────────────────────────────────────────────────────
let storyPopupTimer = null;
let storyPopupOnDismiss = null;

export function showStoryPopup(text, icon, npcId, bonuses, reward, onDismiss = null, setback = null, npcShift = null) {
  if (!text) { if (onDismiss) onDismiss(); return; }
  storyPopupOnDismiss = onDismiss;

  const popup     = $('story-popup');
  const textEl    = $('story-popup-text');
  const npcEl     = $('story-popup-npc');
  const bonusEl   = $('story-popup-bonus');
  const setbackEl = $('story-popup-setback');
  const shiftEl   = $('story-popup-shift');

  textEl.textContent = text;

  if (npcId && NPC_DEFS[npcId]) {
    const def = NPC_DEFS[npcId];
    npcEl.classList.remove('hidden');
    npcEl.innerHTML = '';
    const avatarWrap = buildNpcAvatar(npcId, def, 'story-npc-avatar');
    avatarWrap.classList.add(def.cardClass);
    const infoDiv = el('div', 'story-npc-info');
    infoDiv.appendChild(el('div', 'story-npc-name', def.name));
    infoDiv.appendChild(el('div', 'story-npc-role', def.role));
    npcEl.appendChild(avatarWrap);
    npcEl.appendChild(infoDiv);
  } else {
    npcEl.classList.add('hidden');
  }

  const parts = [];
  if (reward?.faith)        parts.push(`+${reward.faith} ✦ Faith`);
  if (reward?.wisdom)       parts.push(`+${reward.wisdom} ◆ Wisdom`);
  if (reward?.contacts)     parts.push(`+${reward.contacts} contacts`);
  if (reward?.langXP)       parts.push(`+lang XP`);
  if (reward?.npcTrust)     parts.push(`+trust`);
  if (reward?.energyReward) parts.push(`+${reward.energyReward} ⚡`);

  if (parts.length > 0) {
    bonusEl.textContent = parts.join('  ·  ');
    bonusEl.classList.remove('hidden');
  } else {
    bonusEl.classList.add('hidden');
  }

  if (setbackEl) {
    const losses = formatSetbackChips(setback);
    if (losses) { setbackEl.textContent = losses; setbackEl.classList.remove('hidden'); }
    else        { setbackEl.classList.add('hidden'); }
  }

  if (shiftEl) {
    const shiftText = formatNpcShiftChips(npcShift);
    if (shiftText) { shiftEl.textContent = shiftText; shiftEl.classList.remove('hidden'); }
    else           { shiftEl.classList.add('hidden'); }
  }

  popup.classList.remove('hidden');
  if (storyPopupTimer) { clearTimeout(storyPopupTimer); storyPopupTimer = null; }
}

function formatSetbackChips(setback) {
  if (!setback) return null;
  const parts = [];
  if (setback.faith)    parts.push(`−${setback.faith} ✦ Faith`);
  if (setback.wisdom)   parts.push(`−${setback.wisdom} ◆ Wisdom`);
  if (setback.contacts) parts.push(`−${setback.contacts} contacts`);
  if (setback.trust)    parts.push(`−${setback.trust.amount} trust`);
  if (setback.spiritDry && setback.spiritDry > 0) parts.push(`⛅ +${setback.spiritDry}`);
  if (setback.npcMood)   parts.push(`mood ${signed(setback.npcMood.amount)}`);
  if (setback.npcStress) parts.push(`stress ${signed(setback.npcStress.amount)}`);
  if (setback.npcBurden) parts.push(`burden ${signed(setback.npcBurden.amount)}`);
  return parts.length > 0 ? parts.join('  ·  ') : null;
}

function signed(n) { return n > 0 ? `+${n}` : `${n}`; }

function formatNpcShiftChips(npcShift) {
  if (!npcShift) return null;
  const def = NPC_DEFS[npcShift.npcId];
  if (!def) return null;
  const parts = [];
  if (typeof npcShift.mood   === 'number') parts.push(`mood ${signed(npcShift.mood)}`);
  if (typeof npcShift.stress === 'number') parts.push(`stress ${signed(npcShift.stress)}`);
  if (typeof npcShift.burden === 'number') parts.push(`burden ${signed(npcShift.burden)}`);
  if (parts.length === 0) return null;
  return `${def.name}: ${parts.join('  ·  ')}`;
}

function dismissStoryPopup() {
  $('story-popup').classList.add('hidden');
  if (storyPopupTimer) { clearTimeout(storyPopupTimer); storyPopupTimer = null; }
  const cb = storyPopupOnDismiss;
  storyPopupOnDismiss = null;
  if (cb) cb();
}

export function bindStoryPopup() {
  const popup    = $('story-popup');
  const backdrop = $('story-popup-backdrop');
  const card     = popup?.querySelector('.story-popup-card');
  if (backdrop) backdrop.addEventListener('click', dismissStoryPopup);
  if (card)     card.addEventListener('click', dismissStoryPopup);
}

// ─── END-OF-DAY SCREEN ──────────────────────────────────────────────────────────
export function showEndOfDayScreen(onContinue) {
  $('end-of-day-title').textContent = `Day ${state.time.day}`;

  const summary = $('end-of-day-summary');
  summary.innerHTML = '';

  const phases = state.dayLog?.phases || { morning: [], afternoon: [], evening: [] };
  let totalActions = 0;

  ['morning', 'afternoon', 'evening'].forEach(p => {
    const acts = phases[p] || [];
    totalActions += acts.length;
    const row = el('div', 'end-of-day-phase');
    const d = PHASE_DISPLAY[p];
    row.innerHTML = `
      <span class="eod-phase-icon">${d.icon}</span>
      <span class="eod-phase-name">${d.en}</span>
      <span class="eod-phase-actions">${acts.length === 0 ? '— quiet —' : summarizeActions(acts)}</span>
    `;
    summary.appendChild(row);
  });

  const totals = el('div', 'end-of-day-totals');
  totals.innerHTML = `
    <span class="eod-total-row">📌 <strong>${totalActions}</strong> actions</span>
    <span class="eod-total-row">◈ <strong>${state.resources.contacts}</strong> contacts</span>
    <span class="eod-total-row">語 <strong>Lv.${state.language.level}</strong></span>
    <span class="eod-total-row">✓ <strong>${state.milestones.completed.length}</strong> goals</span>
  `;
  summary.appendChild(totals);

  $('end-of-day-reflection').textContent = pickReflection();

  const continueBtn = $('end-of-day-continue');
  continueBtn.textContent = `Continue to Day ${state.time.day + 1} →`;

  $('end-of-day').classList.remove('hidden');

  const newBtn = continueBtn.cloneNode(true);
  continueBtn.parentNode.replaceChild(newBtn, continueBtn);
  newBtn.addEventListener('click', () => {
    $('end-of-day').classList.add('hidden');
    onContinue();
  });
}

function summarizeActions(acts) {
  if (acts.length === 0) return '';
  const counts = {};
  acts.forEach(a => { counts[a.id] = (counts[a.id] || 0) + 1; });
  return Object.entries(counts).map(([id, n]) => {
    const label = actionText(id).en;
    return n > 1 ? `${label} ×${n}` : label;
  }).join(', ');
}

// ─── MODAL ──────────────────────────────────────────────────────────────────────
export function showModal(html, onClose) {
  const overlay = $('modal');
  const card    = $('modal-card');
  card.innerHTML = html;
  overlay.classList.remove('hidden');

  card.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.classList.add('hidden');
      if (onClose) onClose();
    });
  });
}

export function showNPCMeetModal(npcId, onDismiss = null) {
  const def      = NPC_DEFS[npcId];
  const introText = getIntroText(npcId);

  const portraitHtml = `
    <div class="modal-portrait ${def.portraitClass}">
      <img src="assets/images/npcs/${npcId}.png"
           alt="${def.name}"
           class="npc-portrait-img modal-portrait-img"
           onerror="this.style.display='none'">
      <span class="npc-portrait-fallback modal-portrait-fallback">${def.nameJP[0]}</span>
    </div>
  `;

  showModal(`
    ${portraitHtml}
    <div class="modal-title">${def.name} <span class="modal-title-jp">${def.nameJP}</span></div>
    <div class="modal-subtitle">${def.role}</div>
    <div class="modal-body">${introText}</div>
    <button class="modal-btn modal-btn-primary" data-close>Nice to meet you</button>
  `, () => {
    renderPeople();
    renderDock(true);
    if (onDismiss) onDismiss();
  });
}

export function showStageAdvanceModal(npcId, newStage, momentText, onDismiss = null) {
  const def = NPC_DEFS[npcId];
  if (!def) { if (onDismiss) onDismiss(); return; }

  const stageName = def.stages[newStage] || `Stage ${newStage}`;
  const bodyText  = momentText || `Your relationship with ${def.name} has deepened.`;
  const isElder   = newStage === 8;

  let eyebrow;
  if      (isElder)        eyebrow = '— An elder rises —';
  else if (newStage >= 6)  eyebrow = '— Growing in faith —';
  else                     eyebrow = '— Relationship deepening —';

  const portraitHtml = `
    <div class="modal-portrait ${def.portraitClass} stage-advance-portrait${isElder ? ' elder-portrait' : ''}">
      <img src="assets/images/npcs/${npcId}.png"
           alt="${def.name}"
           class="npc-portrait-img modal-portrait-img"
           onerror="this.style.display='none'">
      <span class="npc-portrait-fallback modal-portrait-fallback">${def.nameJP[0]}</span>
    </div>
  `;

  const modal = $('modal');
  modal.classList.add('stage-advance-modal');
  if (isElder) modal.classList.add('elder-modal');

  showModal(`
    <div class="stage-advance-eyebrow${isElder ? ' elder-eyebrow' : ''}">${eyebrow}</div>
    ${portraitHtml}
    <div class="modal-title stage-advance-title">${def.name} <span class="modal-title-jp">${def.nameJP}</span></div>
    <div class="modal-subtitle">Now: ${stageName}</div>
    <div class="modal-body stage-advance-body">${bodyText}</div>
    <button class="modal-btn ${isElder ? 'modal-btn-gold' : 'modal-btn-primary'}" data-close>Continue →</button>
  `, () => {
    modal.classList.remove('stage-advance-modal');
    modal.classList.remove('elder-modal');
    renderPeople();
    renderDock(true);
    if (onDismiss) onDismiss();
  });
}

export function showConversionModal(npcId, text, onDismiss = null) {
  const def = NPC_DEFS[npcId];
  if (!def) return;

  const portraitHtml = `
    <div class="modal-portrait ${def.portraitClass} conversion-portrait">
      <img src="assets/images/npcs/${npcId}.png"
           alt="${def.name}"
           class="npc-portrait-img modal-portrait-img"
           onerror="this.style.display='none'">
      <span class="npc-portrait-fallback modal-portrait-fallback">${def.nameJP[0]}</span>
    </div>
  `;

  const bodyText = text || `${def.name} has put their trust in Christ.`;

  const modal = $('modal');
  modal.classList.add('conversion-modal');

  showModal(`
    <div class="conversion-icon">✝️</div>
    ${portraitHtml}
    <div class="modal-title conversion-title">${def.name} <span class="modal-title-jp">${def.nameJP}</span></div>
    <div class="modal-subtitle">Believer</div>
    <div class="modal-body conversion-body">${bodyText}</div>
    <button class="modal-btn modal-btn-gold" data-close>Bear Witness</button>
  `, () => {
    modal.classList.remove('conversion-modal');
    renderPeople();
    renderDock(true);
    if (onDismiss) onDismiss();
  });
}

export function showConfirmModal(title, body, onConfirm) {
  showModal(`
    <div class="modal-title">${title}</div>
    <div class="modal-body" style="font-style:normal;color:var(--text-muted)">${body}</div>
    <button class="modal-btn modal-btn-danger" id="confirm-yes">Yes, reset everything</button>
    <button class="modal-btn modal-btn-secondary" style="margin-top:8px" data-close>Cancel</button>
  `);
  $('confirm-yes').addEventListener('click', () => {
    $('modal').classList.add('hidden');
    onConfirm();
  });
}

// ─── TRAVEL OVERLAY ──────────────────────────────────────────────────────────
// Cinematic ~5s "you are traveling" transition shown on every trip. Add more clips
// to TRAVEL_VIDEOS for variety — one is picked at random per trip.
const TRAVEL_VIDEOS = ['assets/video/travel.MP4'];
const TRAVEL_DURATION = 5000;
let travelTimer = null;

export function showTravelOverlay(toLocId, onComplete) {
  const overlay = $('travel-overlay');
  const vid     = $('travel-vid');
  const caption = $('travel-caption');
  if (!overlay || !vid) { if (onComplete) onComplete(); return; }

  const def = LOCATION_DEFS[toLocId] || LOCATION_DEFS.apartment;
  if (caption) caption.textContent = `🚃 Traveling to ${def.short}…`;

  vid.src = TRAVEL_VIDEOS[Math.floor(Math.random() * TRAVEL_VIDEOS.length)];
  vid.currentTime = 0;
  vid.play().catch(() => {});

  overlay.classList.remove('hidden');
  void overlay.offsetWidth;
  overlay.classList.add('show');

  if (travelTimer) clearTimeout(travelTimer);
  travelTimer = setTimeout(() => {
    overlay.classList.remove('show');
    setTimeout(() => {
      overlay.classList.add('hidden');
      if (!vid.paused) vid.pause();
      if (onComplete) onComplete();
    }, 400);   // matches .travel-overlay opacity transition
  }, TRAVEL_DURATION);
}

// ─── GO-HOME MODAL ───────────────────────────────────────────────────────────
// Shown when the evening ends and the player is not home. The only way out is the
// Go Home button — no backdrop / data-close dismissal.
export function showGoHomeModal(onGoHome) {
  showModal(`
    <div class="gohome-icon">🌙</div>
    <div class="modal-title">It's getting late</div>
    <div class="modal-body">The last trains will run soon. Time to head home and rest.</div>
    <button class="modal-btn modal-btn-primary" id="gohome-btn">Go Home 🏠</button>
  `);
  const btn = $('gohome-btn');
  if (btn) btn.addEventListener('click', () => {
    $('modal').classList.add('hidden');
    if (onGoHome) onGoHome();
  });
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
export function bindSettings(onReset) {
  const versionEl = $('app-version');
  if (versionEl) {
    versionEl.textContent = `Build ${APP_VERSION} · spellmynameright.github.io/japan-evangelistic-band`;
  }

  $('refresh-app-btn')?.addEventListener('click', () => hardRefreshApp());

  $('header-settings').addEventListener('click', () => {
    $('settings-overlay').classList.remove('hidden');
  });

  $('settings-close').addEventListener('click', () => {
    $('settings-overlay').classList.add('hidden');
  });

  $('settings-overlay').addEventListener('click', e => {
    if (e.target === $('settings-overlay')) $('settings-overlay').classList.add('hidden');
  });

  $('mute-btn').addEventListener('click', () => {
    const { toggleMute } = window._audio;
    const muted = toggleMute();
    $('mute-btn').textContent = muted ? '🔇 Unmute' : '🔊 Mute Music';
  });

  $('reset-btn').addEventListener('click', () => {
    $('settings-overlay').classList.add('hidden');
    showConfirmModal(
      'Reset Progress',
      'This will erase all your progress and start fresh. Are you sure?',
      onReset
    );
  });
}

// ─── FULL RENDER (called on rAF) ────────────────────────────────────────────────
function safeRender(name, fn) {
  try { fn(); } catch (e) { console.error(`[render:${name}]`, e); }
}

export function renderFrame() {
  safeRender('StatsBar',   renderStatsBar);
  safeRender('DayBeat',    renderDayBeat);
  safeRender('Scene',      renderScene);
  safeRender('Anchor',     renderAnchor);
  safeRender('TravelRail', renderTravelRail);
  safeRender('Dock',       () => renderDock());
  safeRender('NavBadge',   () => updateNavBadge());
}
