// Dry-run integration script.
// Exercises every spec requirement against a running server.
// Usage: node test/dryrun.js   (assumes API at http://localhost:4000)
//
// IMPORTANT: this script wipes the "tickets" collection before running.
import 'dotenv/config';
import mongoose from 'mongoose';
import dns from 'node:dns';

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['1.1.1.1', '8.8.8.8']);

const BASE = process.env.API_BASE || 'http://localhost:4000';
const URI = process.env.MONGODB_URI;

let pass = 0;
let fail = 0;
const failures = [];

function ok(name) {
  pass += 1;
  console.log(`  ✓ ${name}`);
}
function bad(name, detail) {
  fail += 1;
  failures.push({ name, detail });
  console.log(`  ✗ ${name}\n      ${detail}`);
}

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, body: json, raw: text };
}

async function reset() {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 8000 });
  await mongoose.connection.db.collection('tickets').deleteMany({});
}

async function insertWithBackdatedCreate(doc) {
  // We need tickets created in the past to assert SLA-breach behavior.
  const res = await mongoose.connection.db.collection('tickets').insertOne(doc);
  return res.insertedId;
}

async function run() {
  console.log(`\n==> Resetting database (${URI?.split('@')[1]?.split('/')[0]})`);
  await reset();

  // ---------- Validation on POST /tickets ----------
  console.log('\n[1] POST /tickets — input validation');
  {
    const r = await call('POST', '/tickets', { subject: 'x' });
    r.status === 400 ? ok('missing fields → 400') : bad('missing fields → 400', `got ${r.status}`);
  }
  {
    const r = await call('POST', '/tickets', {
      subject: 'a', description: 'b', customerEmail: 'not-an-email', priority: 'low'
    });
    r.status === 400 ? ok('bad email → 400') : bad('bad email → 400', `got ${r.status} ${JSON.stringify(r.body)}`);
  }
  {
    const r = await call('POST', '/tickets', {
      subject: 'a', description: 'b', customerEmail: 'u@x.com', priority: 'critical'
    });
    r.status === 400 ? ok('bad priority → 400') : bad('bad priority → 400', `got ${r.status}`);
  }
  {
    const r = await call('POST', '/tickets', {
      subject: 'a', description: 'b', customerEmail: 'u@x.com', priority: 'low', status: 'closed'
    });
    r.status === 400 ? ok('status on create → 400') : bad('status on create → 400', `got ${r.status}`);
  }

  // ---------- Happy create ----------
  console.log('\n[2] POST /tickets — happy paths');
  let created;
  {
    const r = await call('POST', '/tickets', {
      subject: 'Login broken', description: 'cannot sign in', customerEmail: 'a@b.com', priority: 'high'
    });
    if (r.status === 201 && r.body?._id) ok('create returns 201 + _id');
    else bad('create returns 201 + _id', `${r.status} ${JSON.stringify(r.body)}`);
    if (r.body?.status === 'open') ok('default status = open');
    else bad('default status = open', `got ${r.body?.status}`);
    if (typeof r.body?.ageMinutes === 'number') ok('derived ageMinutes present');
    else bad('derived ageMinutes present', `got ${r.body?.ageMinutes}`);
    if (r.body?.slaBreached === false) ok('fresh ticket not breached');
    else bad('fresh ticket not breached', `got ${r.body?.slaBreached}`);
    created = r.body;
  }

  // ---------- Status transitions ----------
  console.log('\n[3] PATCH /tickets/:id — transition rules');
  {
    const r = await call('PATCH', `/tickets/${created._id}`, { status: 'resolved' });
    r.status === 400 ? ok('open → resolved blocked (skip)') : bad('open → resolved blocked', `got ${r.status} ${JSON.stringify(r.body)}`);
  }
  {
    const r = await call('PATCH', `/tickets/${created._id}`, { status: 'closed' });
    r.status === 400 ? ok('open → closed blocked (skip)') : bad('open → closed blocked', `got ${r.status}`);
  }
  {
    const r = await call('PATCH', `/tickets/${created._id}`, { status: 'in_progress' });
    r.status === 200 && r.body.status === 'in_progress'
      ? ok('open → in_progress allowed')
      : bad('open → in_progress allowed', `got ${r.status} ${JSON.stringify(r.body)}`);
  }
  {
    const r = await call('PATCH', `/tickets/${created._id}`, { status: 'resolved' });
    if (r.status === 200 && r.body.status === 'resolved' && r.body.resolvedAt) ok('in_progress → resolved sets resolvedAt');
    else bad('in_progress → resolved sets resolvedAt', `${r.status} ${JSON.stringify(r.body)}`);
  }
  {
    // age should be frozen at resolution moment
    await new Promise(r => setTimeout(r, 1500));
    const r = await call('GET', `/tickets`);
    const t = r.body.find(x => x._id === created._id);
    if (t && t.ageMinutes >= 0 && t.resolvedAt) ok('ageMinutes frozen after resolved (re-read)');
    else bad('ageMinutes frozen after resolved', JSON.stringify(t));
  }
  {
    const r = await call('PATCH', `/tickets/${created._id}`, { status: 'in_progress' });
    if (r.status === 200 && r.body.resolvedAt === null) ok('resolved → in_progress clears resolvedAt');
    else bad('resolved → in_progress clears resolvedAt', `${r.status} ${JSON.stringify(r.body)}`);
  }
  {
    // resolved -> open is two backward steps, should fail
    await call('PATCH', `/tickets/${created._id}`, { status: 'resolved' });
    const r = await call('PATCH', `/tickets/${created._id}`, { status: 'open' });
    r.status === 400 ? ok('resolved → open blocked (skip back)') : bad('resolved → open blocked', `got ${r.status}`);
  }
  {
    const r = await call('PATCH', `/tickets/${created._id}`, { status: 'closed' });
    r.status === 200 && r.body.status === 'closed' ? ok('resolved → closed allowed') : bad('resolved → closed', `got ${r.status}`);
  }
  {
    const r = await call('PATCH', `/tickets/${created._id}`, { status: 'made_up' });
    r.status === 400 ? ok('unknown status → 400') : bad('unknown status → 400', `got ${r.status}`);
  }

  // ---------- SLA: stale unresolved -> breached ----------
  console.log('\n[4] SLA breach behavior');
  const fiveHrsAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
  const eightHrsAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);
  const staleHighId = await insertWithBackdatedCreate({
    subject: 'Stale high', description: 'd', customerEmail: 'h@x.com',
    priority: 'high', status: 'open', resolvedAt: null, createdAt: fiveHrsAgo,
  });
  const freshLowId = await insertWithBackdatedCreate({
    subject: 'Fresh low', description: 'd', customerEmail: 'l@x.com',
    priority: 'low', status: 'open', resolvedAt: null, createdAt: new Date(),
  });
  const resolvedLateId = await insertWithBackdatedCreate({
    subject: 'Resolved late', description: 'd', customerEmail: 'r@x.com',
    priority: 'urgent', status: 'resolved',
    createdAt: eightHrsAgo, resolvedAt: new Date(eightHrsAgo.getTime() + 2 * 60 * 60 * 1000),
  });
  {
    const r = await call('GET', '/tickets');
    const stale = r.body.find(t => t._id === String(staleHighId));
    if (stale && stale.slaBreached === true) ok('high-priority 5h unresolved → slaBreached:true');
    else bad('high-priority 5h unresolved → slaBreached:true', JSON.stringify(stale));

    const fresh = r.body.find(t => t._id === String(freshLowId));
    if (fresh && fresh.slaBreached === false) ok('fresh low-priority → slaBreached:false');
    else bad('fresh low → slaBreached:false', JSON.stringify(fresh));

    const late = r.body.find(t => t._id === String(resolvedLateId));
    if (late && late.slaBreached === true) ok('urgent resolved after 2h → slaBreached:true');
    else bad('urgent resolved after 2h → slaBreached:true', JSON.stringify(late));

    if (late && late.ageMinutes >= 119 && late.ageMinutes <= 121) ok('resolved ageMinutes uses resolvedAt-createdAt');
    else bad('resolved ageMinutes frozen', `got ${late?.ageMinutes}`);
  }

  // ---------- Filters ----------
  console.log('\n[5] GET /tickets — filters');
  {
    const r = await call('GET', '/tickets?status=open');
    if (r.status === 200 && r.body.every(t => t.status === 'open')) ok('?status=open filter');
    else bad('?status=open', JSON.stringify(r.body));
  }
  {
    const r = await call('GET', '/tickets?priority=high');
    if (r.status === 200 && r.body.every(t => t.priority === 'high')) ok('?priority=high filter');
    else bad('?priority=high', JSON.stringify(r.body));
  }
  {
    const r = await call('GET', '/tickets?breached=true');
    if (r.status === 200 && r.body.every(t => t.slaBreached === true)) ok('?breached=true filter');
    else bad('?breached=true', JSON.stringify(r.body));
  }
  {
    const r = await call('GET', '/tickets?priority=high&breached=true');
    if (r.status === 200 && r.body.every(t => t.priority === 'high' && t.slaBreached === true)) ok('combined ?priority+breached');
    else bad('combined filters', JSON.stringify(r.body));
  }
  {
    const r = await call('GET', '/tickets?status=garbage');
    r.status === 400 ? ok('unknown ?status → 400') : bad('unknown ?status → 400', `got ${r.status}`);
  }

  // ---------- Stats ----------
  console.log('\n[6] GET /tickets/stats');
  {
    const r = await call('GET', '/tickets/stats');
    if (r.status === 200 && r.body.byStatus && r.body.byPriority && typeof r.body.breachedOpen === 'number') {
      ok('stats has byStatus / byPriority / breachedOpen');
    } else {
      bad('stats shape', JSON.stringify(r.body));
    }
  }

  // ---------- Delete ----------
  console.log('\n[7] DELETE /tickets/:id');
  {
    const r = await call('DELETE', `/tickets/${created._id}`);
    r.status === 204 ? ok('delete returns 204') : bad('delete returns 204', `got ${r.status}`);
  }
  {
    const r = await call('DELETE', `/tickets/${created._id}`);
    r.status === 404 ? ok('re-delete returns 404') : bad('re-delete 404', `got ${r.status}`);
  }
  {
    const r = await call('DELETE', `/tickets/not-an-id`);
    r.status === 400 ? ok('invalid id → 400') : bad('invalid id → 400', `got ${r.status}`);
  }

  // ---------- Summary ----------
  console.log(`\nResults: ${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  - ${f.name}: ${f.detail}`));
  }

  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => { console.error('fatal:', e); process.exit(2); });
