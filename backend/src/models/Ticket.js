import mongoose from 'mongoose';

// Standard pragmatic email check — good enough; we don't need RFC 5322.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ticketSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: [true, 'subject is required'],
      trim: true,
      minlength: 1,
    },
    description: {
      type: String,
      required: [true, 'description is required'],
      trim: true,
    },
    customerEmail: {
      type: String,
      required: [true, 'customerEmail is required'],
      trim: true,
      lowercase: true,
      validate: {
        validator: (v) => EMAIL_RE.test(v),
        message: 'customerEmail must be a valid email',
      },
    },
    priority: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high', 'urgent'],
        message: "priority must be one of: low, medium, high, urgent",
      },
      required: [true, 'priority is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['open', 'in_progress', 'resolved', 'closed'],
        message: "status must be one of: open, in_progress, resolved, closed",
      },
      default: 'open',
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const Ticket = mongoose.model('Ticket', ticketSchema);
export default Ticket;
