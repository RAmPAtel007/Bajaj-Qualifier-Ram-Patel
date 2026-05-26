import { Router } from 'express';
import mongoose from 'mongoose';
import Ticket from '../models/Ticket.js';
import { derive, TARGET_MIN } from '../lib/sla.js';
import { planTransition, isKnownStatus, PIPELINE } from '../lib/transitions.js';

const router = Router();

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// Helper: shape a ticket doc into the wire format with derived fields.
function toWire(doc, now) {
  const obj = doc.toObject({ versionKey: false });
  const { ageMinutes, slaBreached } = derive(obj, now);
  return { ...obj, ageMinutes, slaBreached };
}

// Translate mongoose validation errors into a flat 400 payload.
function validationPayload(err) {
  const fields = {};
  for (const key of Object.keys(err.errors || {})) {
    fields[key] = err.errors[key].message;
  }
  return { error: 'validation failed', fields };
}

// --- POST /tickets ---------------------------------------------------------
router.post('/', async (req, res, next) => {
  try {
    const { subject, description, customerEmail, priority } = req.body || {};

    // We intentionally reject any client-supplied status on create — spec
    // says it defaults to "open".
    if ('status' in (req.body || {})) {
      return res.status(400).json({ error: 'status cannot be set on create' });
    }

    const t = new Ticket({ subject, description, customerEmail, priority });
    await t.save();
    return res.status(201).json(toWire(t, new Date()));
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json(validationPayload(err));
    next(err);
  }
});

// --- GET /tickets ----------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const { status, priority, breached } = req.query;
    const query = {};

    if (status !== undefined) {
      if (!isKnownStatus(status)) {
        return res.status(400).json({ error: `unknown status: ${status}` });
      }
      query.status = status;
    }
    if (priority !== undefined) {
      if (!PRIORITIES.includes(priority)) {
        return res.status(400).json({ error: `unknown priority: ${priority}` });
      }
      query.priority = priority;
    }

    const docs = await Ticket.find(query).sort({ createdAt: -1 });
    const now = new Date();
    let out = docs.map((d) => toWire(d, now));

    // breached filter has to happen after derive() since it's a computed field.
    if (breached === 'true') {
      out = out.filter((t) => t.slaBreached === true);
    } else if (breached === 'false') {
      out = out.filter((t) => t.slaBreached === false);
    } else if (breached !== undefined) {
      return res.status(400).json({ error: 'breached must be true or false' });
    }

    return res.json(out);
  } catch (err) {
    next(err);
  }
});

// --- GET /tickets/stats ----------------------------------------------------
// Note: order matters — this must be defined before the ":id" route.
router.get('/stats', async (req, res, next) => {
  try {
    const docs = await Ticket.find({});
    const now = new Date();

    const byStatus = Object.fromEntries(PIPELINE.map((s) => [s, 0]));
    const byPriority = Object.fromEntries(PRIORITIES.map((p) => [p, 0]));
    let breachedOpen = 0;

    for (const d of docs) {
      byStatus[d.status] = (byStatus[d.status] || 0) + 1;
      byPriority[d.priority] = (byPriority[d.priority] || 0) + 1;
      const { slaBreached } = derive(d, now);
      // "currently open" = not resolved/closed
      if (slaBreached && d.status !== 'resolved' && d.status !== 'closed') {
        breachedOpen += 1;
      }
    }

    return res.json({
      total: docs.length,
      byStatus,
      byPriority,
      breachedOpen,
      targets: TARGET_MIN,
    });
  } catch (err) {
    next(err);
  }
});

// --- PATCH /tickets/:id ----------------------------------------------------
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'invalid id' });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) return res.status(404).json({ error: 'ticket not found' });

    const body = req.body || {};
    const allowedKeys = ['subject', 'description', 'customerEmail', 'priority', 'status'];
    const unknown = Object.keys(body).filter((k) => !allowedKeys.includes(k));
    if (unknown.length) {
      return res.status(400).json({ error: `unknown fields: ${unknown.join(', ')}` });
    }

    // Handle the status change first so we can return a precise error.
    if ('status' in body && body.status !== ticket.status) {
      if (!isKnownStatus(body.status)) {
        return res.status(400).json({ error: `unknown status: ${body.status}` });
      }
      const plan = planTransition(ticket.status, body.status);
      if (!plan) {
        return res.status(400).json({
          error: `illegal transition: ${ticket.status} -> ${body.status}`,
        });
      }
      ticket.status = body.status;
      if (plan.setResolvedAt) ticket.resolvedAt = new Date();
      if (plan.clearResolvedAt) ticket.resolvedAt = null;
    }

    // Other editable fields. Spec doesn't forbid editing them.
    if ('subject' in body) ticket.subject = body.subject;
    if ('description' in body) ticket.description = body.description;
    if ('customerEmail' in body) ticket.customerEmail = body.customerEmail;
    if ('priority' in body) ticket.priority = body.priority;

    await ticket.save();
    return res.json(toWire(ticket, new Date()));
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json(validationPayload(err));
    next(err);
  }
});

// --- DELETE /tickets/:id ---------------------------------------------------
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'invalid id' });
    }
    const removed = await Ticket.findByIdAndDelete(id);
    if (!removed) return res.status(404).json({ error: 'ticket not found' });
    return res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
