import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  User,
  Center,
  Child,
  Attendance,
  Meal,
  MealMenu,
  Growth,
  Activity,
  StudentParticipation,
  StudentAcademicResult,
  Operation,
  Notice,
  CalendarEvent,
  Fund,
  AcademicProgress,
} from "./models.js";

const app = express();

const passwordPolicyMessage =
  "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a special character.";
const meetsPasswordPolicy = (password) =>
  typeof password === "string" &&
  password.length >= 8 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /[^A-Za-z0-9\s]/.test(password);

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));

app.use(express.json({ limit: "7mb" }));

const tokenSecret = process.env.JWT_SECRET;

const auth =
  (roles = []) =>
  async (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
      if (!token || !tokenSecret)
        return res.status(401).json({ message: "Sign in to continue." });
      const payload = jwt.verify(token, tokenSecret);
      const user = await User.findById(payload.sub).select("-passwordHash");
      if (!user?.active)
        return res.status(401).json({ message: "Account is unavailable." });

      if (roles.length && !roles.includes(user.role))
        return res
          .status(403)
          .json({ message: "You do not have access to this action." });

      req.user = user;
      next();
    } catch {
      res
        .status(401)
        .json({ message: "Your session is invalid or has expired." });
    }
  };

const asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const centerScope = (req, id) =>
  req.user.role === "admin" ||
  req.user.centers.some((c) => String(c) === String(id));

const parseDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? null : d;
};

const getCenter = (req) =>
  req.user.role === "worker"
    ? req.user.centers[0]
    : req.body.center || req.query.center || req.user.centers[0];

app.get("/api/health", (req, res) =>
  res.json({
    status: "ok",
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  }),
);

app.get(
  "/api/dashboard/schools",
  auth(["admin"]),
  asyncRoute(async (_req, res) => {
    res.json(
      await Center.find({ status: "active" })
        .select("_id name centerId")
        .sort("name"),
    );
  }),
);

app.get(
  "/api/dashboard/students",
  auth(["admin"]),
  asyncRoute(async (req, res) => {
    const schoolId = String(req.query.schoolId || "all");

    const centerIds =
      schoolId === "all"
        ? await Center.find({ status: "active" }).distinct("_id")
        : [schoolId];

    if (
      schoolId !== "all" &&
      !(await Center.exists({ _id: schoolId, status: "active" }))
    )
      return res.status(404).json({ message: "School not found." });

    const filter = { center: { $in: centerIds }, active: true };
    const today = new Date();
    const ageGroup = req.query.ageGroup || req.query.age;

    if (ageGroup === "0-3") {
      const lower = new Date(today);
      lower.setFullYear(lower.getFullYear() - 3);
      filter.dateOfBirth = { $gte: lower, $lte: today };
    }

    if (ageGroup === "3-6") {
      const upper = new Date(today);
      upper.setFullYear(upper.getFullYear() - 3);
      const lower = new Date(today);
      lower.setFullYear(lower.getFullYear() - 6);
      filter.dateOfBirth = { $gte: lower, $lt: upper };
    }

    const [total, girls, boys] = await Promise.all([
      Child.countDocuments(filter),
      Child.countDocuments({ ...filter, gender: "female" }),
      Child.countDocuments({ ...filter, gender: "male" }),
    ]);

    res.json({ total, girls, boys });
  }),
);

app.get(
  "/api/dashboard/attendance",
  auth(["admin"]),
  asyncRoute(async (req, res) => {
    const schoolId = String(req.query.schoolId || "all");

    const centers =
      schoolId === "all"
        ? await Center.find({ status: "active" }).select("_id")
        : await Center.find({ _id: schoolId, status: "active" }).select("_id");

    if (schoolId !== "all" && !centers.length)
      return res.status(404).json({ message: "School not found." });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const range = String(req.query.range || "weekly");
    let fromDate;
    let endDate;

    if (range === "custom") {
      if (!req.query.from || !req.query.to)
        return res
          .status(400)
          .json({ message: "Custom range requires from and to dates." });

      fromDate = new Date(`${req.query.from}T00:00:00`);
      const toDate = new Date(`${req.query.to}T00:00:00`);

      if (
        Number.isNaN(fromDate.valueOf()) ||
        Number.isNaN(toDate.valueOf()) ||
        toDate < fromDate ||
        (toDate - fromDate) / 86400000 > 366
      )
        return res
          .status(400)
          .json({ message: "Choose a valid date range up to one year." });

      endDate = new Date(toDate);
      endDate.setDate(endDate.getDate() + 1);
    } else if (range === "monthly") {
      fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    } else {
      const offset = (today.getDay() + 6) % 7;
      fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - offset);
      endDate = new Date(fromDate);
      endDate.setDate(endDate.getDate() + 7);
    }

    const ids = centers.map((center) => center._id);

    const records = await Attendance.find({
      center: { $in: ids },
      date: { $gte: fromDate, $lt: endDate },
    }).select("center date records");

    const dayMap = new Map();

    for (const record of records) {
      const key = new Date(record.date).toISOString().slice(0, 10);

      const row = dayMap.get(key) || {
        present: 0,
        absent: 0,
        schools: new Set(),
      };

      row.present += record.records.filter(
        (item) => item.status === "present",
      ).length;

      row.absent += record.records.filter(
        (item) => item.status === "absent",
      ).length;

      row.schools.add(String(record.center));
      dayMap.set(key, row);
    }

    const days = [];

    for (
      let date = new Date(fromDate);
      date < endDate;
      date.setDate(date.getDate() + 1)
    ) {
      const copy = new Date(date);
      const key = copy.toISOString().slice(0, 10);
      const row = dayMap.get(key);
      const weekend = copy.getDay() === 0 || copy.getDay() === 6;

      days.push({
        date: key,
        present: row?.present || 0,
        absent: row?.absent || 0,
        recorded: !!row,
        holiday: weekend && !row,
      });
    }

    const todayKey = today.toISOString().slice(0, 10);
    const schoolsRecordedToday = dayMap.get(todayKey)?.schools.size || 0;

    res.json({
      days,
      schoolsRecordedToday,
      totalSchools: await Center.countDocuments({ status: "active" }),
    });
  }),
);

const reportScope = async (req, res, schoolId) => {
  if (!mongoose.isValidObjectId(schoolId)) {
    res.status(400).json({ message: "Select a valid school." });
    return null;
  }

  const center = await Center.findOne({ _id: schoolId, status: "active" });

  if (!center) {
    res.status(404).json({ message: "School not found." });
    return null;
  }

  if (
    req.user.role !== "admin" &&
    !req.user.centers.some((id) => String(id) === String(center._id))
  ) {
    res
      .status(403)
      .json({ message: "You can only view your assigned school." });

    return null;
  }

  return center;
};

const reportDates = (range, from, to) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (range === "custom") {
    const start = parseDate(from);
    const end = parseDate(to);
    if (!start || !end || end < start) return null;
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 1);
    return [start, end];
  }

  if (range === "month")
    return [
      new Date(now.getFullYear(), now.getMonth(), 1),
      new Date(now.getFullYear(), now.getMonth() + 1, 1),
    ];

  const days = range === "30d" ? 30 : 7;
  const start = new Date(now);
  start.setDate(start.getDate() - days + 1);
  return [start, new Date(now.getTime() + 86400000)];
};

app.get(
  "/api/reports/school/:schoolId/students",
  auth(["admin", "supervisor", "worker"]),
  asyncRoute(async (req, res) => {
    const center = await reportScope(req, res, req.params.schoolId);
    if (!center) return;
    const filter = { center: center._id, active: true };
    const today = new Date();
    const age = req.query.age || "all";

    if (age === "0-3") {
      const lower = new Date(today);
      lower.setFullYear(lower.getFullYear() - 3);
      filter.dateOfBirth = { $gte: lower, $lte: today };
    }

    if (age === "3-6") {
      const upper = new Date(today);
      upper.setFullYear(upper.getFullYear() - 3);
      const lower = new Date(today);
      lower.setFullYear(lower.getFullYear() - 6);
      filter.dateOfBirth = { $gte: lower, $lt: upper };
    }

    const [total, girls, boys] = await Promise.all([
      Child.countDocuments(filter),
      Child.countDocuments({ ...filter, gender: "female" }),
      Child.countDocuments({ ...filter, gender: "male" }),
    ]);

    res.json({ total, girls, boys });
  }),
);

app.get(
  "/api/reports/school/:schoolId/funds",
  auth(["admin", "supervisor", "worker"]),
  asyncRoute(async (req, res) => {
    const center = await reportScope(req, res, req.params.schoolId);
    if (!center) return;
    const range = String(req.query.range || "8months");
    const now = new Date();

    const start =
      range === "year"
        ? new Date(now.getFullYear(), 0, 1)
        : new Date(now.getFullYear(), now.getMonth() - 7, 1);

    const rows = await Fund.find({
      center: center._id,
      date: {
        $gte: start,
        $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      },
    }).sort("date");

    const monthCount = range === "year" ? 12 : 8;
    const points = [];

    for (let i = monthCount - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      const month = rows.filter(
        (row) =>
          row.date.getFullYear() === date.getFullYear() &&
          row.date.getMonth() === date.getMonth(),
      );

      points.push({
        month: key,
        label: date.toLocaleDateString("en", { month: "short" }),
        received: month.reduce((n, r) => n + r.received, 0),
        spent: month.reduce((n, r) => n + r.spent, 0),
      });
    }

    res.json(points);
  }),
);

app.get(
  "/api/reports/school/:schoolId/academics",
  auth(["admin", "supervisor", "worker"]),
  asyncRoute(async (req, res) => {
    const center = await reportScope(req, res, req.params.schoolId);
    if (!center) return;
    const years = Math.min(8, Math.max(2, Number(req.query.years) || 4));
    const current = new Date().getFullYear();

    const rows = await AcademicProgress.find({
      center: center._id,
      year: { $gte: current - years + 1, $lte: current },
    }).sort("year");

    res.json(rows);
  }),
);

app.get(
  "/api/reports/school/:schoolId/attendance",
  auth(["admin", "supervisor", "worker"]),
  asyncRoute(async (req, res) => {
    const center = await reportScope(req, res, req.params.schoolId);
    if (!center) return;
    const range = String(req.query.range || "7d");
    const dates = reportDates(range, req.query.from, req.query.to);

    if (!dates)
      return res
        .status(400)
        .json({ message: "Choose a valid report date range." });

    const rows = await Attendance.find({
      center: center._id,
      date: { $gte: dates[0], $lt: dates[1] },
    }).select("date records");

    const byDate = new Map(
      rows.map((row) => [row.date.toISOString().slice(0, 10), row]),
    );

    const days = [];

    for (
      let date = new Date(dates[0]);
      date < dates[1];
      date.setDate(date.getDate() + 1)
    ) {
      const key = date.toISOString().slice(0, 10);
      const row = byDate.get(key);
      const present =
        row?.records.filter((item) => item.status === "present").length || 0;
      const absent =
        row?.records.filter((item) => item.status === "absent").length || 0;
      days.push({ date: key, present, absent, recorded: !!row });
    }

    res.json(days);
  }),
);

app.get(
  "/api/reports/school/:schoolId/activities",
  auth(["admin", "supervisor", "worker"]),
  asyncRoute(async (req, res) => {
    const center = await reportScope(req, res, req.params.schoolId);
    if (!center) return;

    const dates = reportDates(
      String(req.query.range || "7d"),
      req.query.from,
      req.query.to,
    );

    if (!dates)
      return res
        .status(400)
        .json({ message: "Choose a valid activity date range." });

    const [activities, total] = await Promise.all([
      Activity.find({
        center: center._id,
        date: { $gte: dates[0], $lt: dates[1] },
      }).sort("-date"),
      Activity.countDocuments({
        center: center._id,
        date: { $gte: dates[0], $lt: dates[1] },
      }),
    ]);

    res.json({
      items: activities,
      completed: total,
      assigned: Math.max(total, 8),
    });
  }),
);

app.get(
  "/api/reports/school/:schoolId/meals",
  auth(["admin", "supervisor", "worker"]),
  asyncRoute(async (req, res) => {
    const center = await reportScope(req, res, req.params.schoolId);
    if (!center) return;

    const dates = reportDates(
      String(req.query.range || "7d"),
      req.query.from,
      req.query.to,
    );

    if (!dates)
      return res
        .status(400)
        .json({ message: "Choose a valid meal date range." });

    const records = await Meal.find({
      center: center._id,
      date: { $gte: dates[0], $lt: dates[1] },
    }).sort("date");

    const days = new Map();

    for (const row of records) {
      const key = row.date.toISOString().slice(0, 10);

      const day = days.get(key) || {
        date: key,
        distributed: 0,
        planned: 0,
        childrenServed: 0,
        recorded: true,
      };

      day.distributed += row.distributedQuantity || 0;
      day.planned += row.plannedQuantity || 0;
      day.childrenServed += row.childrenServed || 0;
      days.set(key, day);
    }

    const points = [];

    for (
      let date = new Date(dates[0]);
      date < dates[1];
      date.setDate(date.getDate() + 1)
    ) {
      const key = date.toISOString().slice(0, 10);

      points.push(
        days.get(key) || {
          date: key,
          distributed: 0,
          planned: 0,
          childrenServed: 0,
          recorded: false,
        },
      );
    }

    res.json({
      days: points,
      totalPortions: records.reduce(
        (n, row) => n + (row.distributedQuantity || 0),
        0,
      ),
      childrenServed: records.reduce(
        (n, row) => n + (row.childrenServed || 0),
        0,
      ),
    });
  }),
);

app.get(
  "/api/notices/recent",
  auth(),
  asyncRoute(async (req, res) => {
    const now = new Date();

    if (req.user.role === "admin") {
      const rows = await Notice.find()
        .sort("-createdAt")
        .limit(3)
        .populate("receipts.center", "name centerId");

      return res.json(rows);
    }

    const centers = req.user.centers || [];

    const rows = await Notice.find({
      "receipts.center": { $in: centers },
      scheduledAt: { $lte: now },
    })
      .sort("-scheduledAt")
      .limit(30)
      .lean();

    res.json(
      rows.map((row) => {
        const receipt = row.receipts.find((item) =>
          centers.some((id) => String(id) === String(item.center)),
        );

        return {
          ...row,
          read: !!receipt?.readAt,
          readAt: receipt?.readAt || null,
        };
      }),
    );
  }),
);

app.post(
  "/api/notices",
  auth(["admin"]),
  asyncRoute(async (req, res) => {
    const {
      title,
      message,
      priority = "normal",
      audience = "all",
      schoolIds = [],
      scheduledAt,
      attachment,
    } = req.body;

    if (!String(title || "").trim() || !String(message || "").trim())
      return res
        .status(400)
        .json({ message: "Title and message are required." });

    let centers;

    if (audience === "all")
      centers = await Center.find({ status: "active" }).select("_id");
    else if (
      audience === "selected" &&
      Array.isArray(schoolIds) &&
      schoolIds.length
    )
      centers = await Center.find({
        _id: { $in: schoolIds },
        status: "active",
      }).select("_id");
    else
      return res.status(400).json({ message: "Select at least one school." });

    if (!centers.length)
      return res.status(400).json({ message: "Select at least one school." });

    if (
      attachment?.data &&
      !/^data:(application\/pdf|image\/(png|jpeg|gif|webp));base64,/.test(
        attachment.data,
      )
    )
      return res
        .status(400)
        .json({ message: "Attachment must be a PDF or image." });

    const notice = await Notice.create({
      title: String(title).trim(),
      message: String(message).trim(),
      priority,
      audience,
      receipts: centers.map((center) => ({ center: center._id })),
      attachment: attachment?.data ? attachment : undefined,
      scheduledAt: scheduledAt ? parseDate(scheduledAt) : new Date(),
      sentBy: req.user._id,
    });

    res.status(201).json(notice);
  }),
);

app.get(
  "/api/notices/:id/receipts",
  auth(["admin"]),
  asyncRoute(async (req, res) => {
    const notice = await Notice.findById(req.params.id).populate(
      "receipts.center",
      "name centerId",
    );

    if (!notice) return res.status(404).json({ message: "Notice not found." });
    res.json(notice.receipts);
  }),
);

app.post(
  "/api/notices/:id/resend",
  auth(["admin"]),
  asyncRoute(async (req, res) => {
    const notice = await Notice.findById(req.params.id);
    if (!notice) return res.status(404).json({ message: "Notice not found." });
    notice.scheduledAt = new Date();
    await notice.save();
    res.json(notice);
  }),
);

app.put(
  "/api/notices/:id/read",
  auth(["worker", "supervisor", "admin"]),
  asyncRoute(async (req, res) => {
    const notice = await Notice.findOne({
      _id: req.params.id,
      "receipts.center": { $in: req.user.centers },
    });

    if (!notice) return res.status(404).json({ message: "Notice not found." });

    const receipt = notice.receipts.find((row) =>
      req.user.centers.some((id) => String(id) === String(row.center)),
    );

    if (receipt && !receipt.readAt) {
      receipt.readAt = new Date();
      await notice.save();
    }

    res.json({ read: true });
  }),
);

app.get(
  "/api/calendar/events",
  auth(),
  asyncRoute(async (req, res) => {
    const from =
      parseDate(req.query.from) ||
      new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const to =
      parseDate(req.query.to) ||
      new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

    const access =
      req.user.role === "admin"
        ? {}
        : {
            $or: [{ audience: "all" }, { centers: { $in: req.user.centers } }],
          };

    const rows = await CalendarEvent.find({
      ...access,
      date: { $gte: from, $lt: to },
    })
      .populate("centers", "name centerId")
      .sort("date");

    const noticeFilter =
      req.user.role === "admin"
        ? { scheduledAt: { $gte: from, $lt: to } }
        : {
            scheduledAt: { $gte: from, $lt: to },
            "receipts.center": { $in: req.user.centers || [] },
          };

    const noticeDates = await Notice.find(noticeFilter).select(
      "scheduledAt title priority",
    );

    res.json({ events: rows, noticeDates });
  }),
);

app.post(
  "/api/calendar/events",
  auth(["admin"]),
  asyncRoute(async (req, res) => {
    const { title, date, time, audience = "all", schoolIds = [] } = req.body;
    const when = parseDate(date);

    if (!String(title || "").trim() || !when)
      return res
        .status(400)
        .json({ message: "Event title and date are required." });

    let centers = [];

    if (audience === "selected") {
      centers = await Center.find({
        _id: { $in: schoolIds },
        status: "active",
      }).select("_id");

      if (!centers.length)
        return res.status(400).json({ message: "Select at least one school." });
    }

    const event = await CalendarEvent.create({
      title: String(title).trim(),
      date: when,
      time,
      audience,
      centers: centers.map((c) => c._id),
      createdBy: req.user._id,
    });

    res.status(201).json(event);
  }),
);

app.get(
  "/api/auth/schools",
  asyncRoute(async (_req, res) => {
    res.json(
      await Center.find({ status: "active" }).select("_id name").sort("name"),
    );
  }),
);

app.post(
  "/api/auth/login",
  asyncRoute(async (req, res) => {
    const { email, username, centerId, password } = req.body;
    let user;

    if (centerId) {
      const center = await Center.findOne({ _id: centerId, status: "active" });

      if (!center)
        return res
          .status(401)
          .json({ message: "Select a valid school to sign in." });

      const identity = String(email || "").trim().toLowerCase();
      user = await User.findOne({
        centers: center._id,
        role: { $in: ["worker", "supervisor"] },
        active: true,
        ...(identity ? { email: identity } : {}),
      }).select("+passwordHash");

      if (identity && !user)
        return res
          .status(401)
          .json({ message: "Email or password is incorrect for this school." });

      if (!identity && password !== "123")
        return res.status(401).json({
          message: "Enter your email and password to sign in to this school.",
        });

      if (!user) {
        user = await User.create({
          name: center.name,
          email: `school-${center.centerId}@anganwadi.local`,
          role: "worker",
          centers: [center._id],
          passwordHash: await bcrypt.hash(center.name, 12),
        });
      }

      if (!identity && user.passwordUpdatedAt)
        return res.status(401).json({
          message: "Enter your email and new password to sign in to this school.",
        });
    } else {
      const identity = String(username || email || "").trim();

      if (identity.toLowerCase() === "administration" && password === "123") {
        user = await User.findOne({
          role: "admin",
          email: "administration",
        }).select("+passwordHash");

        if (!user)
          user = await User.create({
            name: "Administration",
            email: "administration",
            role: "admin",
            passwordHash: await bcrypt.hash("123", 12),
          });
      }

      if (!user)
        user = await User.findOne({
          role: "admin",
          email: identity.toLowerCase(),
        }).select("+passwordHash");
    }

    const demoAdmin =
      !centerId &&
      String(username || email || "")
        .trim()
        .toLowerCase() === "administration" &&
      password === "123" &&
      !user?.passwordUpdatedAt;

    const demoSchool =
      !!centerId &&
      user &&
      !email &&
      password === "123" &&
      !user.passwordUpdatedAt;

    if (
      !user ||
      !user.active ||
      (!demoAdmin &&
        !demoSchool &&
        !(await bcrypt.compare(password || "", user.passwordHash)))
    )
      return res
        .status(401)
        .json({ message: "Username or password is incorrect." });

    if (!tokenSecret)
      return res.status(503).json({ message: "JWT_SECRET is not configured." });

    const token = jwt.sign({ sub: user.id, role: user.role }, tokenSecret, {
      expiresIn: "12h",
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        centers: user.centers,
      },
    });
  }),
);

app.get("/api/auth/me", auth(), (req, res) => res.json({ user: req.user }));

app.post(
  "/api/auth/change-password",
  auth(),
  asyncRoute(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword)
      return res.status(400).json({ message: "Enter your current password." });
    if (!meetsPasswordPolicy(newPassword))
      return res.status(400).json({ message: passwordPolicyMessage });

    const user = await User.findById(req.user._id).select("+passwordHash");
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash)))
      return res.status(401).json({ message: "Current password is incorrect." });

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordUpdatedAt = new Date();
    await user.save();

    res.json({ message: "Your password has been changed." });
  }),
);
// First administrator is bootstrapped explicitly from environment variables; public signup is intentionally disabled.

app.post(
  "/api/auth/bootstrap-admin",
  asyncRoute(async (req, res) => {
    const gate = process.env.ADMIN_BOOTSTRAP_KEY;

    if (!gate || req.headers["x-bootstrap-key"] !== gate)
      return res
        .status(403)
        .json({ message: "Administrator bootstrap is disabled." });

    if (await User.exists({ role: "admin" }))
      return res
        .status(409)
        .json({ message: "An administrator already exists." });

    const { name, email, password } = req.body;

    if (!name || !email || !meetsPasswordPolicy(password))
      return res.status(400).json({
        message: `Provide a name and email. ${passwordPolicyMessage}`,
      });

    const user = await User.create({
      name,
      email,
      role: "admin",
      passwordHash: await bcrypt.hash(password, 12),
      passwordUpdatedAt: new Date(),
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  }),
);

const protectedApi = auth();

app.get(
  "/api/centers",
  protectedApi,
  asyncRoute(async (req, res) => {
    const filter =
      req.user.role === "admin" ? {} : { _id: { $in: req.user.centers } };

    res.json(
      await Center.find(filter)
        .populate("worker", "name email")
        .populate("supervisors", "name email")
        .sort("name"),
    );
  }),
);

app.post(
  "/api/centers",
  auth(["admin"]),
  asyncRoute(async (req, res) =>
    res.status(201).json(await Center.create(req.body)),
  ),
);

app.patch(
  "/api/centers/:id",
  auth(["admin"]),
  asyncRoute(async (req, res) => {
    const c = await Center.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!c) return res.status(404).json({ message: "Center not found." });
    res.json(c);
  }),
);

app.delete(
  "/api/centers/:id",
  auth(["admin"]),
  asyncRoute(async (req, res) => {
    const c = await Center.findByIdAndDelete(req.params.id);
    if (!c) return res.status(404).json({ message: "Center not found." });
    res.json({ message: "Center deleted." });
  }),
);

app.get(
  "/api/users",
  auth(["admin"]),
  asyncRoute(async (req, res) =>
    res.json(
      await User.find()
        .select("-passwordHash")
        .populate("centers", "name centerId")
        .sort("name"),
    ),
  ),
);

app.post(
  "/api/users",
  auth(["admin"]),
  asyncRoute(async (req, res) => {
    const { name, email, password, role, centers = [] } = req.body;

    if (
      !name ||
      !email ||
      !meetsPasswordPolicy(password) ||
      !["worker", "supervisor", "admin"].includes(role)
    )
      return res.status(400).json({
        message: `Provide a name, valid role, and email. ${passwordPolicyMessage}`,
      });

    const user = await User.create({
      name,
      email,
      role,
      centers,
      passwordHash: await bcrypt.hash(password, 12),
      passwordUpdatedAt: new Date(),
    });

    res.status(201).json(await User.findById(user.id).select("-passwordHash"));
  }),
);

app.patch(
  "/api/users/:id",
  auth(["admin"]),
  asyncRoute(async (req, res) => {
    const updates = { ...req.body };

    if (updates.password) {
      if (!meetsPasswordPolicy(updates.password))
        return res.status(400).json({ message: passwordPolicyMessage });

      updates.passwordHash = await bcrypt.hash(updates.password, 12);
      updates.passwordUpdatedAt = new Date();
      delete updates.password;
    }

    const u = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).select("-passwordHash");

    if (!u) return res.status(404).json({ message: "User not found." });
    res.json(u);
  }),
);

app.delete(
  "/api/users/:id",
  auth(["admin"]),
  asyncRoute(async (req, res) => {
    if (req.params.id === req.user.id)
      return res
        .status(400)
        .json({ message: "You cannot remove your own account." });

    const u = await User.findByIdAndDelete(req.params.id);
    if (!u) return res.status(404).json({ message: "User not found." });
    res.json({ message: "User deleted." });
  }),
);

const childFilter = (req) =>
  req.user.role === "admin" ? {} : { center: { $in: req.user.centers } };

app.get(
  "/api/children",
  protectedApi,
  asyncRoute(async (req, res) => {
    const filter = childFilter(req);
    filter.active = true;
    if (req.user.role === "admin" && req.query.center)
      filter.center = req.query.center;
    if (req.query.search)
      filter.name = { $regex: req.query.search, $options: "i" };
    if (req.query.gender) filter.gender = req.query.gender;

    res.json(
      await Child.find(filter)
        .populate("center", "name centerId")
        .sort("rollNo name"),
    );
  }),
);

app.get(
  "/api/children/:id",
  protectedApi,
  asyncRoute(async (req, res) => {
    const c = await Child.findOne({
      _id: req.params.id,
      ...childFilter(req),
    }).populate("center", "name centerId");

    if (!c) return res.status(404).json({ message: "Child not found." });
    res.json(c);
  }),
);

app.post(
  "/api/children",
  auth(["worker", "admin"]),
  asyncRoute(async (req, res) => {
    const center =
      req.user.role === "worker" ? req.user.centers[0] : req.body.center;
    if (!center || !centerScope(req, center))
      return res.status(403).json({ message: "Choose an assigned center." });

    const count = await Child.countDocuments({ center });
    const rollNo =
      String(req.body.rollNo || "").trim() ||
      String(count + 1).padStart(3, "0");

    res.status(201).json(await Child.create({ ...req.body, rollNo, center }));
  }),
);

app.patch(
  "/api/children/:id",
  auth(["worker", "admin"]),
  asyncRoute(async (req, res) => {
    const filter =
      req.user.role === "admin"
        ? { _id: req.params.id }
        : { _id: req.params.id, center: { $in: req.user.centers } };

    const c = await Child.findOneAndUpdate(filter, req.body, {
      new: true,
      runValidators: true,
    });

    if (!c)
      return res
        .status(404)
        .json({ message: "Child not found in your centers." });

    res.json(c);
  }),
);

app.delete(
  "/api/children/:id",
  auth(["worker", "admin"]),
  asyncRoute(async (req, res) => {
    const filter =
      req.user.role === "admin"
        ? { _id: req.params.id }
        : { _id: req.params.id, center: { $in: req.user.centers } };

    const c = await Child.findOneAndUpdate(
      filter,
      { active: false },
      { new: true },
    );

    if (!c) return res.status(404).json({ message: "Child not found." });
    res.json({ message: "Child archived." });
  }),
);

app.get(
  "/api/students/:id/profile",
  protectedApi,
  asyncRoute(async (req, res) => {
    const child = await Child.findOne({
      _id: req.params.id,
      active: true,
    }).populate("center", "name centerId");

    if (!child) return res.status(404).json({ message: "Student not found." });

    if (!centerScope(req, child.center._id))
      return res.status(403).json({
        message: "You can only view students in your assigned center.",
      });

    const [attendanceRows, growth, participation, academic] = await Promise.all(
      [
        Attendance.find({
          center: child.center._id,
          "records.child": child._id,
        })
          .sort("-date")
          .lean(),
        Growth.find({ child: child._id }).sort("-date").limit(20).lean(),
        StudentParticipation.find({ child: child._id })
          .sort("-date")
          .limit(30)
          .lean(),
        StudentAcademicResult.find({ child: child._id })
          .sort("-date")
          .limit(30)
          .lean(),
      ],
    );

    const history = attendanceRows
      .flatMap((row) =>
        row.records
          .filter((record) => String(record.child) === String(child._id))
          .map((record) => ({ date: row.date, status: record.status })),
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const daysPresent = history.filter(
      (row) => row.status === "present",
    ).length;

    res.json({
      child,
      attendance: {
        daysPresent,
        daysRecorded: history.length,
        rate: history.length
          ? Math.round((daysPresent / history.length) * 100)
          : 0,
        history: history.slice(0, 30),
      },
      growth,
      participation,
      academic,
    });
  }),
);

app.post(
  "/api/students/:id/participation",
  auth(["worker", "supervisor", "admin"]),
  asyncRoute(async (req, res) => {
    const child = await Child.findOne({ _id: req.params.id, active: true });

    if (!child || !centerScope(req, child.center))
      return res
        .status(404)
        .json({ message: "Student not found in your assigned center." });

    const date = parseDate(req.body.date);

    if (!date || !String(req.body.title || "").trim())
      return res
        .status(400)
        .json({ message: "Activity title and date are required." });

    const row = await StudentParticipation.create({
      child: child._id,
      center: child.center,
      date,
      title: String(req.body.title).trim(),
      category: req.body.category || "educational",
      remarks: req.body.remarks,
      recordedBy: req.user.id,
    });

    res.status(201).json(row);
  }),
);

app.post(
  "/api/students/:id/academic-results",
  auth(["worker", "supervisor", "admin"]),
  asyncRoute(async (req, res) => {
    const child = await Child.findOne({ _id: req.params.id, active: true });

    if (!child || !centerScope(req, child.center))
      return res
        .status(404)
        .json({ message: "Student not found in your assigned center." });

    const date = parseDate(req.body.date);
    const score = Number(req.body.score);
    const maxScore = Number(req.body.maxScore);

    if (
      !date ||
      !String(req.body.schoolYear || "").trim() ||
      !String(req.body.term || "").trim() ||
      !String(req.body.subject || "").trim() ||
      !Number.isFinite(score) ||
      !Number.isFinite(maxScore) ||
      score < 0 ||
      maxScore <= 0 ||
      score > maxScore
    )
      return res.status(400).json({
        message: "Enter a valid school year, term, subject, date, and score.",
      });

    const row = await StudentAcademicResult.create({
      child: child._id,
      center: child.center,
      date,
      schoolYear: String(req.body.schoolYear).trim(),
      term: String(req.body.term).trim(),
      subject: String(req.body.subject).trim(),
      score,
      maxScore,
      remarks: req.body.remarks,
      recordedBy: req.user.id,
    });

    res.status(201).json(row);
  }),
);

app.get(
  "/api/attendance",
  protectedApi,
  asyncRoute(async (req, res) => {
    const filter =
      req.user.role === "admin" ? {} : { center: { $in: req.user.centers } };
    if (req.query.center && req.user.role === "admin")
      filter.center = req.query.center;

    if (req.query.date) {
      const d = parseDate(req.query.date);
      if (!d) return res.status(400).json({ message: "Invalid date." });

      filter.date = {
        $gte: new Date(d.setHours(0, 0, 0, 0)),
        $lt: new Date(d.setHours(24, 0, 0, 0)),
      };
    }

    res.json(
      await Attendance.find(filter)
        .populate("records.child", "name gender dateOfBirth")
        .populate("center", "name centerId")
        .sort("-date"),
    );
  }),
);

app.put(
  "/api/attendance",
  auth(["worker", "supervisor", "admin"]),
  asyncRoute(async (req, res) => {
    const center = getCenter(req);
    const parsedDate = parseDate(req.body.date);
    if (!center || !centerScope(req, center))
      return res.status(403).json({ message: "Choose an assigned center." });

    if (!parsedDate || !Array.isArray(req.body.records))
      return res
        .status(400)
        .json({ message: "A valid date and attendance records are required." });

    const ids = req.body.records.map((r) => String(r.child));

    if (
      new Set(ids).size !== ids.length ||
      req.body.records.some((r) => !["present", "absent"].includes(r.status))
    )
      return res.status(400).json({
        message:
          "Records must have unique children and a present or absent status.",
      });

    const date = new Date(parsedDate);
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const result = await Attendance.findOneAndUpdate(
      { center, date: { $gte: date, $lt: nextDate } },
      {
        $set: {
          center,
          date,
          records: req.body.records,
          markedBy: req.user.id,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    res.json(result);
  }),
);

app.get(
  "/api/growth",
  protectedApi,
  asyncRoute(async (req, res) => {
    const filter =
      req.user.role === "admin" ? {} : { center: { $in: req.user.centers } };
    if (req.query.child) filter.child = req.query.child;

    res.json(
      await Growth.find(filter)
        .populate("child", "name gender dateOfBirth")
        .populate("center", "name centerId")
        .sort("-date"),
    );
  }),
);

app.post(
  "/api/growth",
  auth(["worker", "supervisor", "admin"]),
  asyncRoute(async (req, res) => {
    const child = await Child.findById(req.body.child);

    if (!child || !centerScope(req, child.center))
      return res
        .status(404)
        .json({ message: "Child not found in your centers." });

    const date = parseDate(req.body.date);

    if (!date)
      return res
        .status(400)
        .json({ message: "A valid measurement date is required." });

    res.status(201).json(
      await Growth.create({
        ...req.body,
        center: child.center,
        date,
        recordedBy: req.user.id,
      }),
    );
  }),
);

app.patch(
  "/api/growth/:id",
  auth(["worker", "admin"]),
  asyncRoute(async (req, res) => {
    const filter =
      req.user.role === "admin"
        ? { _id: req.params.id }
        : { _id: req.params.id, center: { $in: req.user.centers } };

    const updates = { ...req.body };

    if (updates.date) {
      updates.date = parseDate(updates.date);

      if (!updates.date)
        return res
          .status(400)
          .json({ message: "A valid measurement date is required." });
    }

    delete updates.center;
    delete updates.recordedBy;

    const g = await Growth.findOneAndUpdate(filter, updates, {
      new: true,
      runValidators: true,
    });

    if (!g) return res.status(404).json({ message: "Record not found." });
    res.json(g);
  }),
);

app.delete(
  "/api/growth/:id",
  auth(["worker", "admin"]),
  asyncRoute(async (req, res) => {
    const filter =
      req.user.role === "admin"
        ? { _id: req.params.id }
        : { _id: req.params.id, center: { $in: req.user.centers } };

    const g = await Growth.findOneAndDelete(filter);
    if (!g) return res.status(404).json({ message: "Record not found." });
    res.json({ message: "Measurement deleted." });
  }),
);

function registerCollection(path, Model, roles, dateField = "date") {
  app.get(
    `/api/${path}`,
    protectedApi,
    asyncRoute(async (req, res) => {
      const filter =
        req.user.role === "admin" ? {} : { center: { $in: req.user.centers } };
      if (req.query.center && req.user.role === "admin")
        filter.center = req.query.center;

      res.json(
        await Model.find(filter)
          .populate("center", "name centerId")
          .sort("-date"),
      );
    }),
  );

  app.post(
    `/api/${path}`,
    auth(roles),
    asyncRoute(async (req, res) => {
      const center = getCenter(req);
      if (!center || !centerScope(req, center))
        return res.status(403).json({ message: "Choose an assigned center." });
      const date = parseDate(req.body[dateField]);
      if (!date)
        return res.status(400).json({ message: "A valid date is required." });

      res.status(201).json(
        await Model.create({
          ...req.body,
          center,
          [dateField]: date,
          recordedBy: req.user.id,
          submittedBy: req.user.id,
        }),
      );
    }),
  );

  app.patch(
    `/api/${path}/:id`,
    auth(roles),
    asyncRoute(async (req, res) => {
      const filter =
        req.user.role === "admin"
          ? { _id: req.params.id }
          : { _id: req.params.id, center: { $in: req.user.centers } };

      const updates = { ...req.body };

      if (updates[dateField]) {
        updates[dateField] = parseDate(updates[dateField]);
        if (!updates[dateField])
          return res.status(400).json({ message: "A valid date is required." });
      }

      delete updates.center;
      delete updates.recordedBy;
      delete updates.submittedBy;

      const row = await Model.findOneAndUpdate(filter, updates, {
        new: true,
        runValidators: true,
      });

      if (!row) return res.status(404).json({ message: "Record not found." });
      res.json(row);
    }),
  );

  app.delete(
    `/api/${path}/:id`,
    auth(roles),
    asyncRoute(async (req, res) => {
      const filter =
        req.user.role === "admin"
          ? { _id: req.params.id }
          : { _id: req.params.id, center: { $in: req.user.centers } };

      const row = await Model.findOneAndDelete(filter);
      if (!row) return res.status(404).json({ message: "Record not found." });
      res.json({ message: "Record deleted." });
    }),
  );
}

registerCollection("meals", Meal, ["worker", "supervisor", "admin"]);

app.get(
  "/api/meal-menu",
  protectedApi,
  asyncRoute(async (_req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    res.json(
      await MealMenu.findOne({ validFrom: { $lte: today } }).sort("-validFrom"),
    );
  }),
);

app.get(
  "/api/meal-menus",
  auth(["admin"]),
  asyncRoute(async (_req, res) =>
    res.json(await MealMenu.find().sort("-validFrom").limit(20)),
  ),
);

app.put(
  "/api/meal-menu",
  auth(["admin"]),
  asyncRoute(async (req, res) => {
    const validFrom = parseDate(req.body.validFrom);
    const days = req.body.days;

    const week = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];

    if (
      !validFrom ||
      !Array.isArray(days) ||
      days.length !== 7 ||
      new Set(days.map((row) => row.day)).size !== 7 ||
      week.some((day) => !days.some((row) => row.day === day))
    )
      return res
        .status(400)
        .json({ message: "Provide all seven days in the weekly menu." });

    if (
      days.some((row) =>
        ["breakfast", "lunch", "snacks"].some(
          (key) => String(row[key] || "").length > 500,
        ),
      )
    )
      return res.status(400).json({
        message: "Each meal description must be under 500 characters.",
      });

    validFrom.setHours(0, 0, 0, 0);

    const menu = await MealMenu.findOneAndUpdate(
      { validFrom },
      {
        $set: {
          validFrom,
          days: week.map((day) => {
            const row = days.find((item) => item.day === day);

            return {
              day,
              breakfast: String(row.breakfast || "").trim(),
              lunch: String(row.lunch || "").trim(),
              snacks: String(row.snacks || "").trim(),
            };
          }),
          updatedBy: req.user.id,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    res.json(menu);
  }),
);

app.put(
  "/api/meals/today",
  auth(["worker", "supervisor", "admin"]),
  asyncRoute(async (req, res) => {
    const center = getCenter(req);
    if (!center || !centerScope(req, center))
      return res.status(403).json({ message: "Choose an assigned center." });
    const date = new Date();
    date.setHours(0, 0, 0, 0);

    const meal = await Meal.findOneAndUpdate(
      { center, date, type: "lunch" },
      {
        $set: {
          center,
          date,
          type: "lunch",
          completed: true,
          recordedBy: req.user.id,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    res.json(meal);
  }),
);

app.post(
  "/api/activities/punch",
  auth(["admin"]),
  asyncRoute(async (req, res) => {
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const category = [
      "educational",
      "physical",
      "health",
      "creative",
      "nutrition",
    ].includes(req.body.category)
      ? req.body.category
      : "educational";
    const schoolId = String(req.body.schoolId || "all");

    if (!title)
      return res
        .status(400)
        .json({ message: "Activity title is required." });

    const targetCenters =
      schoolId === "all"
        ? await Center.find({ status: "active" }).select("_id")
        : await Center.find({ _id: schoolId, status: "active" }).select("_id");

    if (!targetCenters.length)
      return res
        .status(404)
        .json({ message: "No active school found to assign activity." });

    const now = new Date();

    const created = await Activity.insertMany(
      targetCenters.map((center) => ({
        center: center._id,
        date: now,
        title,
        description,
        category,
        assignedByAdmin: true,
        completed: false,
        remarks: "Punched by Administration",
        recordedBy: req.user.id,
      })),
    );

    res.status(201).json({
      count: created.length,
      title,
      items: created,
    });
  }),
);

app.get(
  "/api/activities/today",
  protectedApi,
  asyncRoute(async (req, res) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const filter = {
      assignedByAdmin: true,
      date: { $gte: start, $lt: end },
    };

    if (req.user.role !== "admin") {
      filter.center = { $in: req.user.centers };
    }

    const items = await Activity.find(filter)
      .populate("center", "name centerId")
      .sort("-date -createdAt");

    res.json({ latest: items[0] || null, items });
  }),
);

app.put(
  "/api/activities/:id/complete",
  auth(["worker", "supervisor", "admin"]),
  asyncRoute(async (req, res) => {
    const activity = await Activity.findById(req.params.id);

    if (!activity || !centerScope(req, activity.center))
      return res
        .status(404)
        .json({ message: "Activity not found for your center." });

    const completed = req.body?.completed !== false;
    activity.completed = completed;
    activity.completedAt = completed ? new Date() : null;
    activity.completedBy = completed ? req.user.id : null;
    await activity.save();

    res.json(activity);
  }),
);

registerCollection("activities", Activity, ["worker", "admin"]);

registerCollection("operations", Operation, ["worker", "admin"]);

app.get(
  "/api/dashboard",
  protectedApi,
  asyncRoute(async (req, res) => {
    const centers =
      req.user.role === "admin"
        ? await Center.find({ status: "active" }).select("_id")
        : req.user.centers.map((_id) => ({ _id }));

    const ids = centers.map((c) => c._id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));

    const [
      children,
      todayRecords,
      meals,
      operations,
      growthThisMonth,
      pendingCenters,
      latestGrowth,
      mealsBySchool,
      girls,
      boys,
      teachers,
      staff,
      upcomingActivities,
      weekRecords,
    ] = await Promise.all([
      Child.countDocuments({ center: { $in: ids }, active: true }),
      Attendance.find({
        center: { $in: ids },
        date: { $gte: today, $lt: tomorrow },
      }),
      Meal.aggregate([
        {
          $match: {
            center: { $in: ids },
            date: { $gte: today, $lt: tomorrow },
          },
        },
        {
          $group: {
            _id: null,
            distributed: { $sum: "$distributedQuantity" },
            childrenServed: { $sum: "$childrenServed" },
          },
        },
      ]),
      Operation.countDocuments({
        center: { $in: ids },
        date: { $gte: today, $lt: tomorrow },
      }),
      Growth.countDocuments({
        center: { $in: ids },
        date: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      }),
      Center.countDocuments({ _id: { $in: ids }, status: "active" }),
      Growth.findOne({ center: { $in: ids } })
        .sort({ date: -1 })
        .select("date"),
      Meal.aggregate([
        {
          $match: {
            center: { $in: ids },
            date: { $gte: today, $lt: tomorrow },
            distributedQuantity: { $gt: 0 },
          },
        },
        { $group: { _id: "$center" } },
        { $count: "schools" },
      ]),
      Child.countDocuments({
        center: { $in: ids },
        active: true,
        gender: "female",
      }),
      Child.countDocuments({
        center: { $in: ids },
        active: true,
        gender: "male",
      }),
      User.countDocuments({
        centers: { $in: ids },
        role: "worker",
        active: true,
      }),
      User.countDocuments({
        centers: { $in: ids },
        role: "supervisor",
        active: true,
      }),
      Activity.find({
        center: { $in: ids },
        date: {
          $gte: today,
          $lt: new Date(
            today.getFullYear(),
            today.getMonth() + 1,
            today.getDate() + 1,
          ),
        },
      })
        .populate("center", "name")
        .sort("date")
        .limit(4),
      Attendance.find({
        center: { $in: ids },
        date: { $gte: weekStart, $lt: tomorrow },
      }).select("date records"),
    ]);

    const present = todayRecords.reduce(
      (n, doc) => n + doc.records.filter((r) => r.status === "present").length,
      0,
    );

    const marked = todayRecords.reduce((n, doc) => n + doc.records.length, 0);

    const attendanceByDay = [
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ].map((day, index) => {
      const rows = weekRecords.filter(
        (row) => (row.date.getDay() + 6) % 7 === index,
      );

      const presentCount = rows.reduce(
        (sum, row) =>
          sum +
          row.records.filter((record) => record.status === "present").length,
        0,
      );

      const absentCount = rows.reduce(
        (sum, row) =>
          sum +
          row.records.filter((record) => record.status === "absent").length,
        0,
      );

      return {
        day,
        present: presentCount,
        absent: absentCount,
        total: presentCount + absentCount,
      };
    });

    res.json({
      centers: ids.length,
      children,
      girls,
      boys,
      teachers,
      staff,
      present,
      absent: Math.max(0, marked - present),
      attendancePercent: marked ? Math.round((present / marked) * 100) : 0,
      schoolsWithAttendance: todayRecords.length,
      mealsDistributed: meals[0]?.distributed || 0,
      childrenServed: meals[0]?.childrenServed || 0,
      schoolsWithMeals: mealsBySchool[0]?.schools || 0,
      growthChecksThisMonth: growthThisMonth,
      latestGrowthAt: latestGrowth?.date || null,
      centersMissingDailyReport: Math.max(0, pendingCenters - operations),
      upcomingActivities,
      attendanceByDay,
    });
  }),
);

app.use((req, res) =>
  res.status(404).json({ message: "API route not found." }),
);

app.use((err, req, res, next) => {
  console.error(err);

  if (err.code === 11000)
    return res
      .status(409)
      .json({ message: "A record with those details already exists." });

  if (err.name === "ValidationError" || err.name === "CastError")
    return res.status(400).json({ message: err.message });
  res.status(500).json({ message: "An unexpected server error occurred." });
});

const port = Number(process.env.PORT || 5000);

if (!process.env.JWT_SECRET)
  console.warn("JWT_SECRET is missing. Set it before using authentication.");

mongoose
  .connect(
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/anganwadi-care",
  )
  .then(() =>
    app.listen(port, () =>
      console.log(`Anganwadi API listening on http://localhost:${port}`),
    ),
  )
  .catch((err) => {
    console.error("Could not connect to MongoDB:", err.message);
    process.exit(1);
  });
