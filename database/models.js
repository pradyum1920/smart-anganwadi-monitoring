import mongoose from "mongoose";

const { Schema, model } = mongoose;

const opts = {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
};

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    passwordUpdatedAt: { type: Date },
    role: {
      type: String,
      enum: ["admin", "worker", "supervisor"],
      required: true,
    },
    centers: [{ type: Schema.Types.ObjectId, ref: "Center" }],
    active: { type: Boolean, default: true },
  },
  opts,
);

const centerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    centerId: { type: String, required: true, unique: true, trim: true },
    address: String,
    state: String,
    district: String,
    block: String,
    village: String,
    worker: { type: Schema.Types.ObjectId, ref: "User" },
    supervisors: [{ type: Schema.Types.ObjectId, ref: "User" }],
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  opts,
);

const childSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    rollNo: { type: String, trim: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ["female", "male", "other"], required: true },
    guardianName: String,
    guardianPhone: String,
    address: String,
    enrolledAt: { type: Date, default: Date.now },
    center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
    active: { type: Boolean, default: true },
  },
  opts,
);

const attendanceSchema = new Schema(
  {
    center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
    date: { type: Date, required: true },
    markedBy: { type: Schema.Types.ObjectId, ref: "User" },
    records: [
      {
        child: { type: Schema.Types.ObjectId, ref: "Child", required: true },
        status: { type: String, enum: ["present", "absent"], required: true },
      },
    ],
  },
  opts,
);

attendanceSchema.index({ center: 1, date: 1 }, { unique: true });

const mealSchema = new Schema(
  {
    center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
    date: { type: Date, required: true },
    type: {
      type: String,
      enum: ["breakfast", "lunch", "snacks"],
      required: true,
    },
    plannedQuantity: { type: Number, min: 0, default: 0 },
    distributedQuantity: { type: Number, min: 0, default: 0 },
    childrenServed: { type: Number, min: 0, default: 0 },
    completed: { type: Boolean, default: false },
    remarks: String,
    recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  opts,
);

const mealMenuDaySchema = new Schema(
  {
    day: {
      type: String,
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      required: true,
    },
    breakfast: { type: String, default: "" },
    lunch: { type: String, default: "" },
    snacks: { type: String, default: "" },
  },
  { _id: false },
);

const mealMenuSchema = new Schema(
  {
    validFrom: { type: Date, required: true },
    days: { type: [mealMenuDaySchema], validate: (rows) => rows.length === 7 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  opts,
);

mealMenuSchema.index({ validFrom: 1 }, { unique: true });

const growthSchema = new Schema(
  {
    child: { type: Schema.Types.ObjectId, ref: "Child", required: true },
    center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
    date: { type: Date, required: true },
    heightCm: { type: Number, min: 30, max: 200, required: true },
    weightKg: { type: Number, min: 1, max: 150, required: true },
    observations: String,
    recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  opts,
);

const activitySchema = new Schema(
  {
    center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
    date: { type: Date, required: true },
    title: { type: String, required: true },
    description: String,
    category: {
      type: String,
      enum: ["educational", "physical", "health", "creative", "nutrition"],
      required: true,
    },
    participants: { type: Number, min: 0, default: 0 },
    remarks: String,
    assignedByAdmin: { type: Boolean, default: false },
    completed: { type: Boolean, default: false },
    completedAt: Date,
    completedBy: { type: Schema.Types.ObjectId, ref: "User" },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  opts,
);

const studentParticipationSchema = new Schema(
  {
    child: { type: Schema.Types.ObjectId, ref: "Child", required: true },
    center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
    date: { type: Date, required: true },
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["educational", "physical", "health", "creative", "nutrition"],
      default: "educational",
    },
    remarks: String,
    recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  opts,
);

studentParticipationSchema.index({ child: 1, date: -1 });

const studentAcademicResultSchema = new Schema(
  {
    child: { type: Schema.Types.ObjectId, ref: "Child", required: true },
    center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
    date: { type: Date, required: true },
    schoolYear: { type: String, required: true, trim: true },
    term: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    score: { type: Number, min: 0, required: true },
    maxScore: { type: Number, min: 1, required: true },
    remarks: String,
    recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  opts,
);

studentAcademicResultSchema.index({ child: 1, date: -1 });

const operationSchema = new Schema(
  {
    center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
    date: { type: Date, required: true },
    staffPresent: { type: Number, min: 0, default: 0 },
    foodStock: {
      type: String,
      enum: ["adequate", "low", "out"],
      default: "adequate",
    },
    suppliesAvailable: { type: Boolean, default: true },
    waterAvailable: { type: Boolean, default: true },
    electricityAvailable: { type: Boolean, default: true },
    infrastructureIssues: String,
    remarks: String,
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  opts,
);

operationSchema.index({ center: 1, date: 1 }, { unique: true });

const noticeSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    priority: {
      type: String,
      enum: ["normal", "important", "urgent"],
      default: "normal",
    },
    audience: { type: String, enum: ["all", "selected"], required: true },
    receipts: [
      {
        center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
        readAt: Date,
      },
    ],
    attachment: { name: String, contentType: String, data: String },
    scheduledAt: { type: Date, default: Date.now },
    sentBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  opts,
);

const calendarEventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    time: String,
    audience: { type: String, enum: ["all", "selected"], default: "all" },
    centers: [{ type: Schema.Types.ObjectId, ref: "Center" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  opts,
);

const fundSchema = new Schema(
  {
    center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
    date: { type: Date, required: true },
    received: { type: Number, min: 0, default: 0 },
    spent: { type: Number, min: 0, default: 0 },
    label: String,
  },
  opts,
);

const academicProgressSchema = new Schema(
  {
    center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
    year: { type: Number, required: true },
    enrolled: { type: Number, min: 0, default: 0 },
    milestonesMet: { type: Number, min: 0, default: 0 },
    progressPercent: { type: Number, min: 0, max: 100, default: 0 },
  },
  opts,
);

academicProgressSchema.index({ center: 1, year: 1 }, { unique: true });

export const User = model("User", userSchema);
export const Center = model("Center", centerSchema);
export const Child = model("Child", childSchema);
export const Attendance = model("Attendance", attendanceSchema);
export const Meal = model("Meal", mealSchema);
export const MealMenu = model("MealMenu", mealMenuSchema);
export const Growth = model("Growth", growthSchema);
export const Activity = model("Activity", activitySchema);

export const StudentParticipation = model(
  "StudentParticipation",
  studentParticipationSchema,
);

export const StudentAcademicResult = model(
  "StudentAcademicResult",
  studentAcademicResultSchema,
);

export const Operation = model("Operation", operationSchema);
export const Notice = model("Notice", noticeSchema);
export const CalendarEvent = model("CalendarEvent", calendarEventSchema);
export const Fund = model("Fund", fundSchema);

export const AcademicProgress = model(
  "AcademicProgress",
  academicProgressSchema,
);
