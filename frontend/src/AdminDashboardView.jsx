import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  ChevronDown,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Bell,
  Utensils,
  Ruler,
  Send,
  Paperclip,
  X,
  CircleCheck,
  AlertCircle,
  Clock3,
  UsersRound,
  ChartNoAxesColumnIncreasing,
  Megaphone,
  GraduationCap,
  Plus,
} from "lucide-react";
import { useDashboardFilters } from "./DashboardFiltersContext.jsx";
import PortalSchoolSelect from "./PortalSchoolSelect.jsx";

async function getJson(path, token) {
  const response = await fetch(`/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await response.json();
  if (!response.ok)
    throw new Error(body.message || "Could not load dashboard data");
  return body;
}

function SchoolSelect({
  schools,
  value,
  onChange,
  label = "Select school",
  all = true,
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const chosen =
    value === "all"
      ? { name: "All schools" }
      : schools.find((s) => s._id === value);

  const options = [
    ...(all ? [{ _id: "all", name: "All schools" }] : []),
    ...schools,
  ].filter((s) =>
    `${s.name} ${s.centerId || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div className="school-combobox">
      <input
        aria-label={label}
        role="combobox"
        aria-expanded={open}
        placeholder={label}
        value={
          open
            ? search
            : `${chosen?.name || label}${chosen?.centerId ? ` (${chosen.centerId})` : ""}`
        }
        onFocus={() => {
          setSearch("");
          setOpen(true);
        }}
        onChange={(e) => setSearch(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);

          if (e.key === "Enter" && options[0]) {
            onChange(options[0]._id);
            setOpen(false);
          }
        }}
      />
      <ChevronDown size={14} />
      {open && (
        <div className="school-options" role="listbox">
          {options.map((s) => (
            <button
              type="button"
              role="option"
              key={s._id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(s._id);
                setOpen(false);
              }}
            >
              {s.name}
              {s.centerId ? ` (${s.centerId})` : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Donut({ data }) {
  const total = data?.total || 0;
  const girls = data?.girls || 0;
  const boys = data?.boys || 0;
  const ratio = total ? girls / total : 0;

  return (
    <div className="donut-row">
      <div
        className="student-donut"
        style={{
          background: `conic-gradient(#86cf70 0 ${ratio * 100}%,#3e6b35 ${ratio * 100}% 100%)`,
        }}
      >
        <div>
          <small>Total</small>
          <strong>{total.toLocaleString()}</strong>
        </div>
      </div>
      <div className="donut-legend">
        <span>
          <i className="girl-dot" /> Girls<b>{girls.toLocaleString()}</b>
        </span>
        <span>
          <i className="boy-dot" /> Boys<b>{boys.toLocaleString()}</b>
        </span>
      </div>
    </div>
  );
}

function useApiMutation(token) {
  const client = useQueryClient();

  return async (path, body, method = "POST") => {
    const response = await fetch(`/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Request failed");
    await client.invalidateQueries({ queryKey: ["notices"] });
    await client.invalidateQueries({ queryKey: ["calendar"] });
    return result;
  };
}

const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function CalendarCard({ token, schools }) {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );

  const [selected, setSelected] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    title: "",
    time: "09:00",
    audience: "all",
    schoolIds: [],
  });

  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const mutate = useApiMutation(token);
  const from = isoLocal(month);
  const to = isoLocal(new Date(month.getFullYear(), month.getMonth() + 1, 1));

  const query = useQuery({
    queryKey: ["calendar", from],
    queryFn: () => getJson(`/calendar/events?from=${from}&to=${to}`, token),
    enabled: !!token,
    refetchInterval: 15000,
  });

  const events = query.data?.events || [];
  const noticeDates = query.data?.noticeDates || [];

  const byDay = useMemo(() => {
    const map = {};

    for (const event of events) {
      const key = isoLocal(new Date(event.date));
      (map[key] ||= []).push(event);
    }

    for (const notice of noticeDates) {
      const key = isoLocal(new Date(notice.scheduledAt));
      (map[key] ||= []).push({ title: notice.title, type: "notice" });
    }

    return map;
  }, [events, noticeDates]);

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  const cells = [
    ...Array(offset).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];

  while (cells.length % 7) cells.push(null);
  const selectedEvents = byDay[selected] || [];

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await mutate("/calendar/events", {
        ...form,
        date: selected,
        audience: form.audience,
        schoolIds: form.audience === "selected" ? form.schoolIds : [],
      });

      setToast("Event added");
      setTimeout(() => setToast(""), 2200);
      setForm({ title: "", time: "09:00", audience: "all", schoolIds: [] });
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="card calendar-card">
      <div className="card-heading">
        <div>
          <div className="eyebrow">SCHOOL CALENDAR</div>
          <h2>Calendar</h2>
        </div>
      </div>
      <div className="calendar-head">
        <button
          aria-label="Previous month"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        >
          <ChevronLeft size={16} />
        </button>
        <b>
          {month.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </b>
        <button
          aria-label="Next month"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="calendar-grid">
        <div className="calendar-weekdays">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <b key={day}>{day}</b>
          ))}
        </div>
        <div className="calendar-dates">
          {cells.map((day, index) => {
            if (!day) return <i key={`blank${index}`} />;

            const key = isoLocal(
              new Date(month.getFullYear(), month.getMonth(), day),
            );

            const isToday = key === isoLocal(new Date());

            return (
              <button
                key={key}
                className={`${isToday ? "today" : ""} ${selected === key ? "chosen" : ""}`}
                onClick={() => {
                  setSelected(key);
                  setShowForm(false);
                }}
              >
                {day}
                {byDay[key]?.length > 0 && <i className="calendar-event-dot" />}
              </button>
            );
          })}
        </div>
      </div>
      <div className="calendar-day-detail">
        <b>
          {selected
            ? new Date(`${selected}T00:00:00`).toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "short",
              })
            : "Select a date"}
        </b>
        {selectedEvents.map((event, i) => (
          <div className="calendar-event-row" key={event._id || i}>
            <span>
              {event.type === "notice" ? (
                <Bell size={13} />
              ) : (
                <CalendarDays size={13} />
              )}
            </span>
            <div>
              <strong>{event.title}</strong>
              <small>
                {event.time || "All day"}
                {event.audience === "selected" ? " · Selected schools" : ""}
              </small>
            </div>
          </div>
        ))}
        {selected && (
          <button
            className="calendar-add-link"
            onClick={() => setShowForm((v) => !v)}
          >
            + Add event
          </button>
        )}
        {showForm && (
          <form className="calendar-event-form" onSubmit={submit}>
            <input
              required
              maxLength={120}
              placeholder="Event title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
            />
            <select
              value={form.audience}
              onChange={(e) =>
                setForm({ ...form, audience: e.target.value, schoolIds: [] })
              }
            >
              <option value="all">All schools</option>
              <option value="selected">Selected schools</option>
            </select>
            {form.audience === "selected" && (
              <select
                multiple
                value={form.schoolIds}
                onChange={(e) =>
                  setForm({
                    ...form,
                    schoolIds: Array.from(
                      e.target.selectedOptions,
                      (o) => o.value,
                    ),
                  })
                }
              >
                {schools.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            {error && <small className="notice-error">{error}</small>}
            <button className="primary-button">Save event</button>
          </form>
        )}
      </div>
      {toast && (
        <div className="inline-success">
          <CircleCheck size={14} />
          {toast}
        </div>
      )}
    </section>
  );
}

function NoticeCard({ token, schools }) {
  const [form, setForm] = useState({
    title: "",
    message: "",
    priority: "normal",
    audience: "all",
    schoolIds: [],
    mode: "now",
    scheduledAt: "",
    attachment: null,
  });

  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [detail, setDetail] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const mutate = useApiMutation(token);

  const query = useQuery({
    queryKey: ["notices", "recent"],
    queryFn: () => getJson("/notices/recent", token),
    refetchInterval: 15000,
  });

  const notices = query.data || [];

  const upload = async (file) => {
    if (!file) {
      setForm({ ...form, attachment: null });
      return;
    }

    if (!/^application\/pdf$|^image\/(png|jpeg|gif|webp)$/.test(file.type)) {
      setError("Attach a PDF or supported image.");
      return;
    }

    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    setForm((v) => ({
      ...v,
      attachment: { name: file.name, contentType: file.type, data },
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.audience === "selected" && !form.schoolIds.length) {
      setError("Select at least one school.");
      return;
    }

    try {
      await mutate("/notices", {
        title: form.title,
        message: form.message,
        priority: form.priority,
        audience: form.audience,
        schoolIds: form.schoolIds,
        attachment: form.attachment,
        scheduledAt:
          form.mode === "schedule"
            ? new Date(form.scheduledAt).toISOString()
            : new Date().toISOString(),
      });

      setToast(
        form.mode === "schedule"
          ? "Notice scheduled"
          : "Notice sent to schools",
      );

      setTimeout(() => setToast(""), 3000);

      setForm({
        title: "",
        message: "",
        priority: "normal",
        audience: "all",
        schoolIds: [],
        mode: "now",
        scheduledAt: "",
        attachment: null,
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const openDetail = async (notice) => {
    setDetail(notice);

    try {
      setReceipts(await getJson(`/notices/${notice._id}/receipts`, token));
    } catch (err) {
      setError(err.message);
    }
  };

  const resend = async () => {
    try {
      await mutate(`/notices/${detail._id}/resend`, {});
      setToast("Notice resent to unread schools");
      setTimeout(() => setToast(""), 2500);
      await openDetail(detail);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="card notice-card">
      <div className="card-heading">
        <div>
          <div className="eyebrow">BROADCAST</div>
          <h2>Send notice</h2>
        </div>
        <Send size={18} />
      </div>
      <form className="notice-form" onSubmit={submit}>
        <label>
          Title
          <input
            required
            maxLength={140}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Notice title"
          />
        </label>
        <label>
          Message
          <textarea
            required
            maxLength={5000}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder="Write a message for schools"
          />
          <small className="character-count">{form.message.length}/5000</small>
        </label>
        <div className="notice-form-row">
          <label>
            Priority
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              <option value="normal">Normal</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label>
            Audience
            <select
              value={form.audience}
              onChange={(e) =>
                setForm({ ...form, audience: e.target.value, schoolIds: [] })
              }
            >
              <option value="all">All schools</option>
              <option value="selected">Selected schools</option>
            </select>
          </label>
        </div>
        {form.audience === "selected" && (
          <select
            aria-label="Select schools"
            multiple
            className="notice-school-multi"
            value={form.schoolIds}
            onChange={(e) =>
              setForm({
                ...form,
                schoolIds: Array.from(e.target.selectedOptions, (o) => o.value),
              })
            }
          >
            {schools.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.centerId})
              </option>
            ))}
          </select>
        )}
        <label className="notice-attachment">
          <Paperclip size={14} /> Attachment (PDF/image)
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => upload(e.target.files?.[0])}
          />
          {form.attachment && <small>{form.attachment.name}</small>}
        </label>
        <div className="notice-schedule">
          <label>
            <input
              type="radio"
              checked={form.mode === "now"}
              onChange={() => setForm({ ...form, mode: "now" })}
            />{" "}
            Send now
          </label>
          <label>
            <input
              type="radio"
              checked={form.mode === "schedule"}
              onChange={() => setForm({ ...form, mode: "schedule" })}
            />{" "}
            Schedule
          </label>
          {form.mode === "schedule" && (
            <input
              type="datetime-local"
              required
              value={form.scheduledAt}
              onChange={(e) =>
                setForm({ ...form, scheduledAt: e.target.value })
              }
            />
          )}
        </div>
        {error && (
          <div className="notice-error">
            <AlertCircle size={14} />
            {error}
          </div>
        )}
        <button className="notice-submit">
          <Send size={14} />
          {form.mode === "now" ? "Send notice" : "Schedule notice"}
        </button>
      </form>
      {toast && (
        <div className="inline-success">
          <CircleCheck size={14} />
          {toast}
        </div>
      )}
      <div className="recent-notices">
        <div className="mini-section-head">
          <b>Recent notices</b>
          <small>Last 3</small>
        </div>
        {notices.length ? (
          notices.slice(0, 3).map((notice) => {
            const read = notice.receipts?.filter((r) => r.readAt).length || 0;
            const total = notice.receipts?.length || 0;

            return (
              <button
                className="recent-notice-row"
                key={notice._id}
                onClick={() => openDetail(notice)}
              >
                <span>
                  <b>{notice.title}</b>
                  <small>
                    {new Date(
                      notice.scheduledAt || notice.createdAt,
                    ).toLocaleDateString()}
                  </small>
                </span>
                <span className={`priority-chip ${notice.priority}`}>
                  {notice.priority}
                </span>
                <small>
                  Read by {read} of {total} schools
                </small>
              </button>
            );
          })
        ) : (
          <div className="notice-empty">No notices sent yet.</div>
        )}
      </div>
      {detail && (
        <div
          className="notice-detail-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDetail(null);
          }}
        >
          <section className="notice-detail">
            <button
              className="notice-close"
              onClick={() => setDetail(null)}
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <div className="eyebrow">NOTICE DELIVERY</div>
            <h3>{detail.title}</h3>
            <p>{detail.message}</p>
            <div className="receipt-list">
              {receipts.map((row) => (
                <div key={row._id}>
                  <span>{row.center?.name}</span>
                  <small>
                    {row.readAt
                      ? `Read ${new Date(row.readAt).toLocaleString()}`
                      : "Unread"}
                  </small>
                </div>
              ))}
            </div>
            {receipts.some((row) => !row.readAt) && (
              <button className="notice-submit" onClick={resend}>
                Resend to unread schools
              </button>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function QuickActions({ onSendNotice, onAttendance, onStudents, onReports }) {
  const actions = [
    [Send, "Send Notice", onSendNotice],
    [CalendarDays, "View Attendance", onAttendance],
    [UsersRound, "Manage Students", onStudents],
    [ChartNoAxesColumnIncreasing, "Generate Report", onReports],
  ];

  return (
    <section className="card quick-actions-card">
      <div className="card-heading">
        <h2>
          <span className="quick-heading-icon">
            <Megaphone size={16} />
          </span>
          Quick Actions
        </h2>
      </div>
      <div className="quick-action-list">
        {actions.map(([Icon, label, action]) => (
          <button className="quick-action-button" key={label} onClick={action}>
            <span>
              <Icon size={16} />
            </span>
            <b>{label}</b>
            <ArrowRight size={14} />
          </button>
        ))}
      </div>
    </section>
  );
}

function RecentActivityCard({ token, schools = [] }) {
  const client = useQueryClient();
  const [punchOpen, setPunchOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "educational",
    schoolId: "all",
  });

  const presets = [
    "Learning through stories",
    "Nutrition and wellbeing circle",
    "Outdoor movement session",
    "Creative activity hour",
  ];

  const query = useQuery({
    queryKey: ["dashboard", "recent-activity"],
    queryFn: () => getJson("/activities", token),
    enabled: !!token,
    refetchInterval: 15000,
  });

  const rawRows = (Array.isArray(query.data) ? query.data : [])
    .filter((row) => new Date(row.date) <= new Date())
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const rows = useMemo(() => {
    const grouped = [];
    const seenAdminBatches = new Map();

    for (const row of rawRows) {
      if (row.assignedByAdmin) {
        const minuteKey = `${row.title}|${new Date(row.date).toISOString().slice(0, 16)}`;
        if (seenAdminBatches.has(minuteKey)) {
          const existing = seenAdminBatches.get(minuteKey);
          existing._totalCount += 1;
          if (row.completed) existing._doneCount += 1;
          continue;
        }
        const entry = {
          ...row,
          _totalCount: 1,
          _doneCount: row.completed ? 1 : 0,
        };
        seenAdminBatches.set(minuteKey, entry);
        grouped.push(entry);
      } else {
        grouped.push(row);
      }

      if (grouped.length >= 4) break;
    }

    return grouped;
  }, [rawRows]);

  const ago = (date) => {
    const hours = Math.max(
      1,
      Math.floor((Date.now() - new Date(date).getTime()) / 3600000),
    );

    return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
  };

  const punchActivity = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || busy) return;
    setBusy(true);
    setError("");
    setToast("");

    try {
      const response = await fetch("/api/activities/punch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.message || "Could not punch activity.");

      await client.invalidateQueries({
        queryKey: ["dashboard", "recent-activity"],
      });

      setForm({
        title: "",
        description: "",
        category: "educational",
        schoolId: "all",
      });
      setPunchOpen(false);
      setToast(
        `Punched "${body.title}" to ${body.count} school${body.count === 1 ? "" : "s"}`,
      );
      setTimeout(() => setToast(""), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card recent-activity-card">
      <div className="card-heading">
        <h2>
          <span className="recent-clock">
            <Clock3 size={16} />
          </span>
          Recent Activity
        </h2>
        <div className="activity-head-actions">
          <button
            type="button"
            className="activity-punch-btn"
            onClick={() => {
              setPunchOpen((v) => !v);
              setError("");
            }}
          >
            <Plus size={14} />
            {punchOpen ? "Close" : "Punch activity"}
          </button>
          <span className="activity-live">Live</span>
        </div>
      </div>
      {punchOpen && (
        <form className="activity-punch-form" onSubmit={punchActivity}>
          <div className="activity-preset-row">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                className={form.title === preset ? "active" : ""}
                onClick={() => setForm({ ...form, title: preset })}
              >
                {preset}
              </button>
            ))}
          </div>
          <input
            required
            placeholder="Activity to perform at schools…"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <input
            placeholder="Instructions / short note (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="activity-punch-row">
            <select
              aria-label="Activity category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="educational">Educational</option>
              <option value="health">Health</option>
              <option value="physical">Physical</option>
              <option value="creative">Creative</option>
              <option value="nutrition">Nutrition</option>
            </select>
            <select
              aria-label="Target school"
              value={form.schoolId}
              onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
            >
              <option value="all">All schools</option>
              {schools.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {error && <div className="notice-error">{error}</div>}
          <button className="activity-punch-submit" disabled={busy}>
            <Send size={13} />
            {busy ? "Punching…" : "Punch to schools"}
          </button>
        </form>
      )}
      {toast && (
        <div className="inline-success">
          <CircleCheck size={14} />
          {toast}
        </div>
      )}
      {query.isLoading ? (
        <div className="dashboard-skeleton activity-skeleton" />
      ) : query.error ? (
        <div className="dashboard-empty">Could not load recent activity.</div>
      ) : rows.length ? (
        rows.map((row, index) => (
          <div className="recent-activity-row" key={row._id}>
            <i className={`activity-timeline-dot tone-${index % 4}`} />
            <span>
              <b>
                {row.title}
                {row.assignedByAdmin && (
                  <em className="activity-punched-tag">
                    {row._doneCount}/{row._totalCount} done
                  </em>
                )}
              </b>
              <small>{row.description || row.category}</small>
            </span>
            <time>{ago(row.date)}</time>
          </div>
        ))
      ) : (
        <div className="dashboard-empty activity-empty">
          No recent activity yet.
        </div>
      )}
    </section>
  );
}

function NoticeBoard({ token, onCompose }) {
  const [active, setActive] = useState(null);
  const [receipts, setReceipts] = useState([]);

  const query = useQuery({
    queryKey: ["notices", "recent"],
    queryFn: () => getJson("/notices/recent", token),
    enabled: !!token,
    refetchInterval: 15000,
  });

  const notices = query.data || [];

  const open = async (notice) => {
    setActive(notice);

    try {
      setReceipts(await getJson(`/notices/${notice._id}/receipts`, token));
    } catch {
      setReceipts([]);
    }
  };

  return (
    <section className="card notice-board-card">
      <div className="card-heading">
        <h2>
          <span className="notice-board-icon">
            <Megaphone size={16} />
          </span>
          Notice Board
        </h2>
        <button className="text-link" onClick={onCompose}>
          View all <ArrowRight size={14} />
        </button>
      </div>
      {query.isLoading ? (
        <div className="dashboard-skeleton activity-skeleton" />
      ) : notices.length ? (
        notices.slice(0, 3).map((notice) => (
          <button
            className="notice-board-row"
            key={notice._id}
            onClick={() => open(notice)}
          >
            <i className={`priority-dot ${notice.priority}`} />
            <b>{notice.title}</b>
            <time>
              {new Date(
                notice.scheduledAt || notice.createdAt,
              ).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
              })}
            </time>
          </button>
        ))
      ) : (
        <div className="dashboard-empty notice-board-empty">
          No notices sent yet.
        </div>
      )}
      {active && (
        <div
          className="notice-detail-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setActive(null);
          }}
        >
          <section className="notice-detail">
            <button
              className="notice-close"
              onClick={() => setActive(null)}
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <div className="eyebrow">NOTICE DELIVERY</div>
            <h3>{active.title}</h3>
            <p>{active.message}</p>
            <div className="receipt-list">
              {receipts.map((row) => (
                <div key={row._id}>
                  <span>{row.center?.name}</span>
                  <small>
                    {row.readAt
                      ? `Read ${new Date(row.readAt).toLocaleString()}`
                      : "Unread"}
                  </small>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function PromoCard() {
  return (
    <section className="card admin-promo-card">
      <div className="promo-orbit orbit-one" />
      <div className="promo-orbit orbit-two" />
      <GraduationCap size={32} />
      <b>A brighter future starts here</b>
      <p>Every little step helps children thrive.</p>
      <span className="promo-link">
        Care. Learn. Grow. <ArrowRight size={13} />
      </span>
      <div className="promo-books" aria-hidden="true">
        ▰<br />▰ ▰<br />▰ ▰ ▰
      </div>
    </section>
  );
}

export default function AdminDashboardView({
  stats,
  token,
  onViewStudents,
  onReports,
}) {
  const filters = useDashboardFilters();
  const [age, setAge] = useState("all");
  const [showComposer, setShowComposer] = useState(false);

  const schoolsQuery = useQuery({
    queryKey: ["dashboard", "schools"],
    queryFn: () => getJson("/dashboard/schools", token),
    enabled: !!token,
    staleTime: 300000,
  });

  const schools = schoolsQuery.data || [];
  const schoolId = filters.studentsSchoolId;

  const studentsQuery = useQuery({
    queryKey: ["dashboard", "students", schoolId, age],
    queryFn: () =>
      getJson(
        `/dashboard/students?schoolId=${encodeURIComponent(schoolId)}&ageGroup=${age}`,
        token,
      ),
    enabled: !!token,
  });

  return (
    <div className="admin-dashboard-layout">
      <CalendarCard token={token} schools={schools} />
      <QuickActions
        onSendNotice={() => setShowComposer(true)}
        onAttendance={onReports}
        onStudents={() => onViewStudents?.("all")}
        onReports={onReports}
      />
      <RecentActivityCard token={token} schools={schools} />
      <NoticeBoard token={token} onCompose={() => setShowComposer(true)} />
      <section className="card students-dashboard-card">
        <div className="card-heading">
          <h2>
            <span className="students-heading-icon">
              <UsersRound size={16} />
            </span>
            Students Overview
          </h2>
          <div className="admin-card-controls">
            <PortalSchoolSelect
              schools={schools}
              value={schoolId}
              onChange={(id) => filters.selectSchool("students", id)}
              label="School"
            />
            <select
              aria-label="Age group"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            >
              <option value="all">All ages</option>
              <option value="0-3">0–3 years</option>
              <option value="3-6">3–6 years</option>
            </select>
          </div>
        </div>
        {studentsQuery.isLoading ? (
          <div className="dashboard-skeleton" />
        ) : studentsQuery.data?.total ? (
          <>
            <Donut data={studentsQuery.data} />
            <div className="students-overview-legend">
              <span>
                <i className="girl-dot" /> Girls{" "}
                <b>
                  {studentsQuery.data.girls.toLocaleString()} (
                  {Math.round(
                    (studentsQuery.data.girls / studentsQuery.data.total) * 100,
                  )}
                  %)
                </b>
              </span>
              <span>
                <i className="boy-dot" /> Boys{" "}
                <b>
                  {studentsQuery.data.boys.toLocaleString()} (
                  {Math.round(
                    (studentsQuery.data.boys / studentsQuery.data.total) * 100,
                  )}
                  %)
                </b>
              </span>
            </div>
          </>
        ) : (
          <div className="dashboard-empty">No students registered yet</div>
        )}
        <button
          className="text-link view-students-link"
          onClick={() => onViewStudents?.(schoolId)}
        >
          View all students <ArrowRight size={14} />
        </button>
        <div className="students-dashboard-total">
          Network total <b>{(stats?.children ?? 1700).toLocaleString()}</b>
        </div>
      </section>
      <PromoCard />
      {showComposer && (
        <div
          className="admin-notice-compose-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowComposer(false);
          }}
        >
          <div className="admin-notice-compose">
            <button
              className="notice-close"
              aria-label="Close notice composer"
              onClick={() => setShowComposer(false)}
            >
              <X size={16} />
            </button>
            <NoticeCard token={token} schools={schools} />
          </div>
        </div>
      )}
    </div>
  );
}
