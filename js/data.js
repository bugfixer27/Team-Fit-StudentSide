// Turns the raw `load` payload into the tiny, display-only model this site needs:
// people (name, grade, email, team, events) and events (name, slots, who fills them per team).
// Nothing from the form answers themselves is kept.

export const TEAMS = {
  A: { key: 'A', name: 'Maroon', short: 'Maroon', slug: 'maroon', color: '#8a1c34', glow: '#c2334f', ink: '#ffd9df', tagline: '' },
  B: { key: 'B', name: 'Gold',   short: 'Gold',   slug: 'gold',   color: '#d4a72c', glow: '#f2c94c', ink: '#fff2c7', tagline: '' },
  C: { key: 'C', name: 'Beige', short: 'Beige', slug: 'tan', color: '#c9a77c', glow: '#e8cfa6', ink: '#fff5e6', tagline: '' }
};
export const TEAM_KEYS = ['A', 'B', 'C'];

export const GRADE_NAMES = { 9: 'Freshman', 10: 'Sophomore', 11: 'Junior', 12: 'Senior' };

function handle(email) {
  const h = String(email || '').split('@')[0];
  return h ? h.replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Unknown';
}

export function buildModel(data) {
  const responses = Array.isArray(data.responses) ? data.responses : [];
  const state = data.state || {};
  const members = state.members || {};
  const assignments = state.assignments || {};
  const eventDefs = Array.isArray(data.events) ? data.events : [];

  const people = new Map();
  const ensure = (email) => {
    const key = String(email || '').toLowerCase();
    if (!people.has(key)) people.set(key, { email: key, name: handle(key), grade: null, team: null, events: [], noResponse: true });
    return people.get(key);
  };

  for (const r of responses) {
    const p = ensure(r.email);
    p.name = r.name || p.name;
    p.grade = r.grade == null ? null : Number(r.grade);
    p.noResponse = false;
  }
  for (const [email, m] of Object.entries(members)) {
    const p = ensure(email);
    p.team = TEAM_KEYS.includes(m && m.team) ? m.team : null;
  }

  const events = eventDefs.map(e => {
    const ev = { name: e.name, slots: Number(e.slots) || 2, type: e.type || 'study', teams: { A: [], B: [], C: [] } };
    for (const t of TEAM_KEYS) {
      const list = (assignments[t] && assignments[t][e.name]) || [];
      for (const email of list) {
        const p = ensure(email);
        ev.teams[t].push(p);
        p.events.push({ name: e.name, team: t, type: ev.type });
      }
    }
    return ev;
  });

  const list = [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
  for (const p of list) p.events.sort((a, b) => a.name.localeCompare(b.name));

  const byTeam = { A: [], B: [], C: [], none: [] };
  for (const p of list) byTeam[p.team || 'none'].push(p);

  const stats = {};
  for (const t of TEAM_KEYS) {
    const ppl = byTeam[t];
    const grades = { 9: 0, 10: 0, 11: 0, 12: 0 };
    for (const p of ppl) if (grades[p.grade] != null) grades[p.grade]++;
    const slotsTotal = events.reduce((n, e) => n + e.slots, 0);
    const slotsFilled = events.reduce((n, e) => n + Math.min(e.teams[t].length, e.slots), 0);
    stats[t] = { members: ppl.length, grades, slotsFilled, slotsTotal };
  }

  return {
    version: data.version,
    updatedAt: data.updatedAt || null,
    people: list,
    byTeam,
    events,
    stats,
    totals: { people: list.length, placed: list.length - byTeam.none.length, events: events.length }
  };
}

export function gradeLabel(grade) {
  if (grade == null || !GRADE_NAMES[grade]) return 'Grade —';
  return `${GRADE_NAMES[grade]} · ${grade}`;
}
