import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CalendarCheck2,
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  ClipboardCheck,
  HeartPulse,
  Home,
  Moon,
  Plus,
  Search,
  Sun,
  UsersRound,
  UserRound,
  Utensils,
} from "lucide-react";
import "./students.css";

const dateKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "No record yet";

const ageOf = (value) => {
  if (!value) return "Age not recorded";
  const birth = new Date(value);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();

  if (
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  )
    years--;

  return `${Math.max(0, years)} years old`;
};

async function request(path, token, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

export default function StudentDashboardView({
  user,
  token,
  initialStudentId,
  darkMode,
  onToggleTheme,
  onNavigate,
  onBack,
  onLogout,
}) {
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [profile, setProfile] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [showParticipationForm, setShowParticipationForm] = useState(false);
  const [showAcademicForm, setShowAcademicForm] = useState(false);
  const [showAddStudentForm, setShowAddStudentForm] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [newStudent, setNewStudent] = useState({
    name: "",
    dateOfBirth: "2022-05-15",
    gender: "female",
    guardianName: "",
    guardianPhone: "",
    address: "",
  });

  const [participation, setParticipation] = useState({
    date: dateKey(),
    title: "",
    category: "educational",
    remarks: "",
  });

  const [academic, setAcademic] = useState({
    date: dateKey(),
    schoolYear: String(new Date().getFullYear()),
    term: "Term 1",
    subject: "",
    score: "",
    maxScore: "100",
    remarks: "",
  });

  useEffect(() => {
    let alive = true;

    request("/children", token)
      .then((rows) => {
        if (!alive) return;
        setStudents(Array.isArray(rows) ? rows : []);

        setSelectedId(
          rows?.find((row) => row._id === initialStudentId)?._id ||
            rows?.[0]?._id ||
            "",
        );
      })
      .catch((e) => setError(e.message))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [token, initialStudentId]);

  useEffect(() => {
    if (!selectedId) return;
    let alive = true;
    setProfile(null);
    setProfileLoading(true);

    request(`/students/${selectedId}/profile`, token)
      .then((data) => alive && setProfile(data))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setProfileLoading(false));

    return () => {
      alive = false;
    };
  }, [selectedId, token]);

  const filtered = useMemo(
    () =>
      students.filter((student) =>
        student.name?.toLowerCase().includes(search.toLowerCase()),
      ),
    [students, search],
  );

  const child = profile?.child;
  const latestGrowth = profile?.growth?.[0];

  const average = profile?.academic?.length
    ? Math.round(
        profile.academic.reduce(
          (sum, row) => sum + (row.score / row.maxScore) * 100,
          0,
        ) / profile.academic.length,
      )
    : null;

  const flash = (message) => {
    setNotice(message);
    setTimeout(() => setNotice(""), 2600);
  };

  const navigate = (label) => {
    setMenuOpen(false);
    onNavigate(label);
  };

  const addStudent = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");

    try {
      const created = await request("/children", token, {
        method: "POST",
        body: JSON.stringify(newStudent),
      });

      const updatedList = await request("/children", token);
      setStudents(Array.isArray(updatedList) ? updatedList : []);
      if (created?._id) setSelectedId(created._id);

      setNewStudent({
        name: "",
        dateOfBirth: "2022-05-15",
        gender: "female",
        guardianName: "",
        guardianPhone: "",
        address: "",
      });

      setShowAddStudentForm(false);
      flash(`${created?.name || "Student"} added`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const submitRecord = async (kind, event) => {
    event.preventDefault();
    if (!child || saving) return;
    setSaving(true);
    setFormError("");

    try {
      const data = kind === "participation" ? participation : academic;
      const endpoint =
        kind === "participation" ? "participation" : "academic-results";

      await request(`/students/${child._id}/${endpoint}`, token, {
        method: "POST",
        body: JSON.stringify(data),
      });

      setProfile(await request(`/students/${child._id}/profile`, token));

      if (kind === "participation") {
        setParticipation({ ...participation, title: "", remarks: "" });
        setShowParticipationForm(false);
      } else {
        setAcademic({ ...academic, subject: "", score: "", remarks: "" });
        setShowAcademicForm(false);
      }

      flash(
        kind === "participation"
          ? "Participation recorded"
          : "Academic result saved",
      );
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const links = [
    ["Home", Home],
    ["Children", UsersRound],
    ["Attendance", CalendarCheck2],
    ["Meal Menu", Utensils],
    ["Reports", ChartNoAxesColumnIncreasing],
  ];

  return (
    <div className={`app-shell student-app ${darkMode ? "dark-mode" : ""}`}>
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">A</div>
          <div>
            <b>ANGANWADI</b>
            <small>CARE & GROW</small>
          </div>
        </div>
        <div className="center-chip">
          <span className="live-dot" />
          {user.centers?.[0]?.name || user.name}
          <ChevronDown size={15} />
        </div>
        <div className="side-label">WORKSPACE</div>
        {links.map(([label, Icon]) => (
          <button
            key={label}
            className={`side-link ${label === "Children" ? "selected" : ""}`}
            onClick={() => navigate(label)}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
        <button className="side-link" onClick={onLogout}>
          <UserRound size={18} />
          Sign out
        </button>
        <div className="side-bottom">
          <div className="avatar small">{user.name?.[0]}</div>
          <div>
            <b>{user.name}</b>
            <small>{user.role}</small>
          </div>
          <ChevronDown size={15} />
        </div>
      </aside>
      {menuOpen && <div className="shade" onClick={() => setMenuOpen(false)} />}
      <main className="main">
        <header className="topbar">
          <button
            className="menu-btn"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            <UsersRound size={20} />
          </button>
          <div className="crumb">
            My workspace <span>/</span> Children
          </div>
          <div className="top-right">
            <div className="date-chip">
              <CalendarCheck2 size={16} />
              <strong>
                {new Date().toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </strong>
            </div>
            <button
              className="theme-toggle"
              onClick={onToggleTheme}
              aria-label="Switch theme"
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <div className="avatar">{user.name?.[0]}</div>
            <button
              type="button"
              className="topbar-back-btn"
              onClick={onBack || (() => onNavigate("Home"))}
              aria-label="Go back"
            >
              <ArrowLeft size={15} />
              <span>Back</span>
            </button>
          </div>
        </header>
        <div className="content student-content">
          <div className="student-page-heading">
            <div>
              <div className="eyebrow">
                STUDENT RECORDS <span className="live-dot" />
              </div>
              <h1>Children</h1>
              <p className="subheading">
                Attendance, health, participation and learning records for each
                student.
              </p>
            </div>
            <div className="student-heading-actions">
              <div className="student-count-chip">
                <UsersRound size={16} />
                {students.length} students
              </div>
              <button
                type="button"
                className="student-add-main-btn"
                onClick={() => setShowAddStudentForm((v) => !v)}
              >
                <Plus size={15} />
                {showAddStudentForm ? "Close form" : "Add student"}
              </button>
            </div>
          </div>
          {showAddStudentForm && (
            <form
              className="card student-create-card"
              onSubmit={addStudent}
            >
              <div className="student-create-head">
                <div>
                  <div className="eyebrow">NEW ENROLMENT</div>
                  <h2>Add a student to your center</h2>
                </div>
              </div>
              <div className="student-create-grid">
                <label>
                  Student full name
                  <input
                    required
                    placeholder="e.g. Aarav Verma"
                    value={newStudent.name}
                    onChange={(e) =>
                      setNewStudent({ ...newStudent, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Date of birth
                  <input
                    type="date"
                    required
                    value={newStudent.dateOfBirth}
                    onChange={(e) =>
                      setNewStudent({
                        ...newStudent,
                        dateOfBirth: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Gender
                  <select
                    value={newStudent.gender}
                    onChange={(e) =>
                      setNewStudent({ ...newStudent, gender: e.target.value })
                    }
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label>
                  Guardian name
                  <input
                    placeholder="Parent / Guardian name"
                    value={newStudent.guardianName}
                    onChange={(e) =>
                      setNewStudent({
                        ...newStudent,
                        guardianName: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Guardian phone
                  <input
                    placeholder="10-digit mobile"
                    value={newStudent.guardianPhone}
                    onChange={(e) =>
                      setNewStudent({
                        ...newStudent,
                        guardianPhone: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Address
                  <input
                    placeholder="Village / Ward / Street"
                    value={newStudent.address}
                    onChange={(e) =>
                      setNewStudent({ ...newStudent, address: e.target.value })
                    }
                  />
                </label>
              </div>
              <button className="student-save-button" disabled={saving}>
                {saving ? "Saving student…" : "Save student"}
              </button>
            </form>
          )}
          {error && (
            <div className="student-alert">
              {error}
              <button onClick={() => setError("")}>Dismiss</button>
            </div>
          )}
          <div className="student-layout">
            <aside className="student-directory card">
              <div className="student-directory-head">
                <div>
                  <div className="eyebrow">YOUR CENTRE</div>
                  <h2>Student directory</h2>
                </div>
                <b>{students.length}</b>
              </div>
              <label className="student-search">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search students"
                  aria-label="Search students"
                />
              </label>
              <div className="student-list">
                {loading ? (
                  <div className="student-empty">Loading students…</div>
                ) : filtered.length ? (
                  filtered.map((row, idx) => (
                    <button
                      key={row._id}
                      className={`student-list-row ${row._id === selectedId ? "active" : ""}`}
                      onClick={() => {
                        setSelectedId(row._id);
                        setError("");
                        setFormError("");
                      }}
                    >
                      <span className="student-avatar">
                        {row.name
                          ?.split(/\s+/)
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <span className="student-list-name">
                        <b>{row.name}</b>
                        <small>
                          Roll No:{" "}
                          {row.rollNo || String(idx + 1).padStart(3, "0")} ·{" "}
                          {row.gender || "Student"}
                        </small>
                      </span>
                      <ArrowRight size={15} />
                    </button>
                  ))
                ) : (
                  <div className="student-empty">
                    No students match your search.
                  </div>
                )}
              </div>
            </aside>
            <section className="student-profile-area">
              {profileLoading && !profile ? (
                <div className="card student-loading">
                  Loading student profile…
                </div>
              ) : !child ? (
                <div className="card student-loading">
                  Choose a student to view their records.
                </div>
              ) : (
                <>
                  <section className="card student-identity">
                    <div className="student-avatar large">
                      {child.name
                        ?.split(/\s+/)
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div className="student-identity-main">
                      <div className="eyebrow">INDIVIDUAL STUDENT PROFILE</div>
                      <h2>{child.name}</h2>
                      <p>
                        {ageOf(child.dateOfBirth)} <span>·</span>{" "}
                        {child.gender || "Gender not recorded"} <span>·</span>{" "}
                        {child.center?.name || "Your centre"}
                      </p>
                      <small>
                        Guardian: {child.guardianName || "Not recorded"}
                        {child.guardianPhone ? ` · ${child.guardianPhone}` : ""}
                      </small>
                    </div>
                    <div className="student-enrolled">
                      <small>ENROLLED</small>
                      <b>{formatDate(child.enrolledAt)}</b>
                    </div>
                  </section>
                  <div className="student-metrics">
                    <Metric
                      icon={CalendarCheck2}
                      label="ATTENDANCE"
                      value={`${profile.attendance.rate}%`}
                      detail={`${profile.attendance.daysPresent} days present of ${profile.attendance.daysRecorded} recorded`}
                    />
                    <Metric
                      icon={HeartPulse}
                      label="LAST HEALTH CHECK"
                      value={
                        latestGrowth
                          ? formatDate(latestGrowth.date)
                          : "No checkup"
                      }
                      detail={
                        latestGrowth
                          ? `${latestGrowth.heightCm} cm · ${latestGrowth.weightKg} kg`
                          : "No growth record saved"
                      }
                    />
                    <Metric
                      icon={ClipboardCheck}
                      label="PARTICIPATION"
                      value={profile.participation.length}
                      detail="recorded activities"
                    />
                    <Metric
                      icon={BookOpenCheck}
                      label="ACADEMIC AVERAGE"
                      value={average === null ? "—" : `${average}%`}
                      detail={`${profile.academic.length} assessment${profile.academic.length === 1 ? "" : "s"} recorded`}
                    />
                  </div>
                  <div className="student-record-grid">
                    <RecordSection
                      title="Attendance history"
                      eyebrow="PRESENCE"
                      icon={CalendarCheck2}
                      actionText="View latest 30 days"
                    >
                      <div className="student-attendance-summary">
                        <b>{profile.attendance.daysPresent}</b>
                        <span>days present</span>
                        <small>
                          {profile.attendance.daysRecorded} attendance days
                          recorded · {profile.attendance.rate}% present
                        </small>
                      </div>
                      {profile.attendance.history.length ? (
                        <div className="student-record-list">
                          {profile.attendance.history
                            .slice(0, 8)
                            .map((row, index) => (
                              <div
                                className="student-record-row"
                                key={`${row.date}-${index}`}
                              >
                                <span
                                  className={`record-status ${row.status}`}
                                />
                                <span>
                                  <b>
                                    {row.status === "present"
                                      ? "Present"
                                      : "Absent"}
                                  </b>
                                  <small>{formatDate(row.date)}</small>
                                </span>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <Empty>
                          No attendance has been recorded for this student.
                        </Empty>
                      )}
                    </RecordSection>
                    <RecordSection
                      title="Health checkups"
                      eyebrow="GROWTH & WELLBEING"
                      icon={HeartPulse}
                      actionText={
                        latestGrowth
                          ? `Last checked ${formatDate(latestGrowth.date)}`
                          : "No checks yet"
                      }
                    >
                      {profile.growth.length ? (
                        <div className="student-record-list">
                          {profile.growth.slice(0, 8).map((row) => (
                            <div className="student-record-row" key={row._id}>
                              <span className="record-icon">
                                <HeartPulse size={14} />
                              </span>
                              <span>
                                <b>
                                  {row.heightCm} cm · {row.weightKg} kg
                                </b>
                                <small>
                                  {formatDate(row.date)}
                                  {row.observations
                                    ? ` · ${row.observations}`
                                    : ""}
                                </small>
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Empty>No health checkups have been saved yet.</Empty>
                      )}
                    </RecordSection>
                    <RecordSection
                      title="Participation"
                      eyebrow="ACTIVITIES"
                      icon={UsersRound}
                      action={
                        <button
                          className="student-add-button"
                          onClick={() => {
                            setShowParticipationForm((v) => !v);
                            setFormError("");
                          }}
                        >
                          <Plus size={14} />
                          {showParticipationForm ? "Close" : "Add activity"}
                        </button>
                      }
                    >
                      {showParticipationForm && (
                        <form
                          className="student-record-form"
                          onSubmit={(e) => submitRecord("participation", e)}
                        >
                          <label>
                            Activity title
                            <input
                              required
                              value={participation.title}
                              onChange={(e) =>
                                setParticipation({
                                  ...participation,
                                  title: e.target.value,
                                })
                              }
                              placeholder="Storytelling circle"
                            />
                          </label>
                          <div className="student-form-row">
                            <label>
                              Date
                              <input
                                required
                                type="date"
                                value={participation.date}
                                onChange={(e) =>
                                  setParticipation({
                                    ...participation,
                                    date: e.target.value,
                                  })
                                }
                              />
                            </label>
                            <label>
                              Type
                              <select
                                value={participation.category}
                                onChange={(e) =>
                                  setParticipation({
                                    ...participation,
                                    category: e.target.value,
                                  })
                                }
                              >
                                <option value="educational">Learning</option>
                                <option value="physical">Physical</option>
                                <option value="health">Health</option>
                                <option value="creative">Creative</option>
                                <option value="nutrition">Nutrition</option>
                              </select>
                            </label>
                          </div>
                          <label>
                            Note (optional)
                            <input
                              value={participation.remarks}
                              onChange={(e) =>
                                setParticipation({
                                  ...participation,
                                  remarks: e.target.value,
                                })
                              }
                              placeholder="How the student participated"
                            />
                          </label>
                          <FormError message={formError} />
                          <button
                            className="student-save-button"
                            disabled={saving}
                          >
                            {saving ? "Saving…" : "Save participation"}
                          </button>
                        </form>
                      )}
                      {profile.participation.length ? (
                        <div className="student-record-list">
                          {profile.participation.map((row) => (
                            <div className="student-record-row" key={row._id}>
                              <span className="record-icon">
                                <UsersRound size={14} />
                              </span>
                              <span>
                                <b>{row.title}</b>
                                <small>
                                  {formatDate(row.date)} · {row.category}
                                  {row.remarks ? ` · ${row.remarks}` : ""}
                                </small>
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        !showParticipationForm && (
                          <Empty>No participation has been recorded yet.</Empty>
                        )
                      )}
                    </RecordSection>
                    <RecordSection
                      title="Academic results"
                      eyebrow="LEARNING PROGRESS"
                      icon={BookOpenCheck}
                      action={
                        <button
                          className="student-add-button"
                          onClick={() => {
                            setShowAcademicForm((v) => !v);
                            setFormError("");
                          }}
                        >
                          <Plus size={14} />
                          {showAcademicForm ? "Close" : "Add result"}
                        </button>
                      }
                    >
                      {showAcademicForm && (
                        <form
                          className="student-record-form"
                          onSubmit={(e) => submitRecord("academic", e)}
                        >
                          <div className="student-form-row">
                            <label>
                              School year
                              <input
                                required
                                value={academic.schoolYear}
                                onChange={(e) =>
                                  setAcademic({
                                    ...academic,
                                    schoolYear: e.target.value,
                                  })
                                }
                                placeholder="2026"
                              />
                            </label>
                            <label>
                              Term
                              <input
                                required
                                value={academic.term}
                                onChange={(e) =>
                                  setAcademic({
                                    ...academic,
                                    term: e.target.value,
                                  })
                                }
                                placeholder="Term 1"
                              />
                            </label>
                          </div>
                          <div className="student-form-row">
                            <label>
                              Subject
                              <input
                                required
                                value={academic.subject}
                                onChange={(e) =>
                                  setAcademic({
                                    ...academic,
                                    subject: e.target.value,
                                  })
                                }
                                placeholder="Language"
                              />
                            </label>
                            <label>
                              Date
                              <input
                                required
                                type="date"
                                value={academic.date}
                                onChange={(e) =>
                                  setAcademic({
                                    ...academic,
                                    date: e.target.value,
                                  })
                                }
                              />
                            </label>
                          </div>
                          <div className="student-form-row">
                            <label>
                              Score
                              <input
                                required
                                type="number"
                                min="0"
                                value={academic.score}
                                onChange={(e) =>
                                  setAcademic({
                                    ...academic,
                                    score: e.target.value,
                                  })
                                }
                              />
                            </label>
                            <label>
                              Out of
                              <input
                                required
                                type="number"
                                min="1"
                                value={academic.maxScore}
                                onChange={(e) =>
                                  setAcademic({
                                    ...academic,
                                    maxScore: e.target.value,
                                  })
                                }
                              />
                            </label>
                          </div>
                          <label>
                            Teacher note (optional)
                            <input
                              value={academic.remarks}
                              onChange={(e) =>
                                setAcademic({
                                  ...academic,
                                  remarks: e.target.value,
                                })
                              }
                              placeholder="Progress or support needed"
                            />
                          </label>
                          <FormError message={formError} />
                          <button
                            className="student-save-button"
                            disabled={saving}
                          >
                            {saving ? "Saving…" : "Save academic result"}
                          </button>
                        </form>
                      )}
                      {profile.academic.length ? (
                        <div className="student-record-list">
                          {profile.academic.map((row) => (
                            <div className="student-record-row" key={row._id}>
                              <span className="record-icon">
                                <BookOpenCheck size={14} />
                              </span>
                              <span>
                                <b>
                                  {row.subject}: {row.score}/{row.maxScore}
                                </b>
                                <small>
                                  {row.schoolYear} · {row.term} ·{" "}
                                  {formatDate(row.date)}
                                  {row.remarks ? ` · ${row.remarks}` : ""}
                                </small>
                              </span>
                              <strong>
                                {Math.round((row.score / row.maxScore) * 100)}%
                              </strong>
                            </div>
                          ))}
                        </div>
                      ) : (
                        !showAcademicForm && (
                          <Empty>
                            No academic results have been recorded yet.
                          </Empty>
                        )
                      )}
                    </RecordSection>
                  </div>
                </>
              )}
            </section>
          </div>
          {notice && <div className="toast">{notice}</div>}
        </div>
        <nav className="mobile-nav">
          {links.map(([label, Icon]) => (
            <button
              key={label}
              className={label === "Children" ? "active" : ""}
              onClick={() => navigate(label)}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }) {
  return (
    <section className="card student-metric">
      <span>
        <Icon size={16} />
      </span>
      <div className="eyebrow">{label}</div>
      <b>{value}</b>
      <small>{detail}</small>
    </section>
  );
}

function RecordSection({
  title,
  eyebrow,
  icon: Icon,
  action,
  actionText,
  children,
}) {
  return (
    <section className="card student-record-section">
      <div className="student-section-heading">
        <span className="student-section-icon">
          <Icon size={16} />
        </span>
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h3>{title}</h3>
        </div>
        {action || <small>{actionText}</small>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }) {
  return <div className="student-empty record-empty">{children}</div>;
}

function FormError({ message }) {
  return message ? <div className="student-form-error">{message}</div> : null;
}
