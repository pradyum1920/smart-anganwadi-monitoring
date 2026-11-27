import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  ChevronDown,
  Home,
  Moon,
  Utensils,
  UsersRound,
  ChartNoAxesColumnIncreasing,
  UserRound,
  Sun,
  Check,
} from "lucide-react";
import "./meal-menu.css";

const week = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const todayName = new Intl.DateTimeFormat("en", { weekday: "long" }).format(
  new Date(),
);

const inputDate = (value) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const emptyDays = () =>
  week.map((day) => ({ day, breakfast: "", lunch: "", snacks: "" }));

const dateLabel = (value) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Not published";

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

export function MealMenuView({
  user,
  token,
  darkMode,
  onToggleTheme,
  onNavigate,
  onBack,
  onLogout,
}) {
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    request("/meal-menu", token)
      .then((data) => alive && setMenu(data))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [token]);

  const links = [
    ["Home", Home],
    ["Children", UsersRound],
    ["Attendance", CalendarDays],
    ["Meal Menu", Utensils],
    ["Reports", ChartNoAxesColumnIncreasing],
  ];

  return (
    <div className={`app-shell ${darkMode ? "dark-mode" : ""}`}>
      <aside className="sidebar">
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
            className={`side-link ${label === "Meal Menu" ? "selected" : ""}`}
            onClick={() => onNavigate(label)}
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
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="crumb">
            My workspace <span>/</span> Meal Menu
          </div>
          <div className="top-right">
            <div className="date-chip">
              <CalendarDays size={16} />
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
        <div className="content meal-menu-content">
          <div className="meal-menu-title">
            <div>
              <div className="eyebrow">
                WEEKLY MEALS <span className="live-dot" />
              </div>
              <h1>Meal Menu</h1>
              <p className="subheading">
                The current meal plan published by your administration.
              </p>
            </div>
            <div className="menu-date-chip">
              <CalendarDays size={15} />
              {menu
                ? `Effective ${dateLabel(menu.validFrom)}`
                : "Awaiting menu"}
            </div>
          </div>
          {error && <div className="admin-alert error">{error}</div>}
          {loading ? (
            <div className="card meal-menu-empty">Loading menu…</div>
          ) : !menu ? (
            <div className="card meal-menu-empty">
              <span>
                <Utensils size={23} />
              </span>
              <h2>No menu published yet</h2>
              <p>Your administration will publish the weekly meal plan here.</p>
            </div>
          ) : (
            <div className="weekly-menu-grid">
              {week.map((day) => {
                const row = menu.days?.find((item) => item.day === day) || {};

                return (
                  <section
                    key={day}
                    className={`card meal-day-card ${todayName === day ? "today" : ""}`}
                  >
                    <div className="meal-day-heading">
                      <div>
                        <small>
                          {todayName === day ? "TODAY" : "WEEKLY MENU"}
                        </small>
                        <h2>{day}</h2>
                      </div>
                      {todayName === day && (
                        <span className="today-chip">
                          <Check size={12} />
                          Today
                        </span>
                      )}
                    </div>
                    <MealSlot label="Morning snack" value={row.breakfast} />
                    <MealSlot
                      label="Hot-cooked midday meal"
                      value={row.lunch}
                    />
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <nav className="mobile-nav">
        {links.map(([label, Icon]) => (
          <button
            key={label}
            className={label === "Meal Menu" ? "active" : ""}
            onClick={() => onNavigate(label)}
          >
            <Icon size={19} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export function AdminMealMenuView({ token, darkMode, onBack }) {
  const [days, setDays] = useState(emptyDays);
  const [validFrom, setValidFrom] = useState(todayKey);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const loadVersion = (version) => {
    setSelectedVersion(version?._id || "");
    setValidFrom(version ? inputDate(version.validFrom) : todayKey());

    setDays(
      version
        ? week.map(
            (day) =>
              version.days?.find((row) => row.day === day) || {
                day,
                breakfast: "",
                lunch: "",
                snacks: "",
              },
          )
        : emptyDays(),
    );

    setError("");
    setSaved("");
  };

  const refresh = async () => {
    setLoading(true);

    try {
      const rows = await request("/meal-menus", token);
      setVersions(rows);
      if (rows.length) loadVersion(rows[0]);
      else loadVersion(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [token]);

  const change = (day, key, value) =>
    setDays((current) =>
      current.map((row) => (row.day === day ? { ...row, [key]: value } : row)),
    );

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved("");

    try {
      const menu = await request("/meal-menu", token, {
        method: "PUT",
        body: JSON.stringify({ validFrom, days }),
      });

      setSaved(`Menu saved. Effective ${dateLabel(menu.validFrom)}.`);
      const rows = await request("/meal-menus", token);
      setVersions(rows);
      loadVersion(rows.find((row) => row._id === menu._id) || menu);
      setSaved(`Menu saved. Effective ${dateLabel(menu.validFrom)}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`admin-page ${darkMode ? "dark-mode" : ""}`}>
      <header className="admin-top">
        <div className="brand">
          <div className="brand-icon">A</div>
          <div>
            <b>ANGANWADI</b>
            <small>CARE & GROW</small>
          </div>
        </div>
        <div className="admin-top-actions">
          <button onClick={onBack}>
            <ArrowRight className="back-arrow" size={15} /> Back to dashboard
          </button>
        </div>
      </header>
      <main className="admin-content meal-admin-content">
        <div className="eyebrow">ADMINISTRATION</div>
        <h1>Weekly meal menu</h1>
        <p className="admin-intro">
          Publish the meals each centre should serve. Set an effective date to
          schedule menu changes.
        </p>
        {error && <div className="admin-alert error">{error}</div>}
        {saved && <div className="admin-alert success">{saved}</div>}
        <div className="meal-admin-layout">
          <section className="admin-card meal-editor-card">
            <div className="meal-editor-head">
              <div>
                <h2>Edit menu</h2>
                <p>Updates appear in the school Meal Menu page.</p>
              </div>
              <button
                className="meal-new-version"
                type="button"
                onClick={() => loadVersion(null)}
              >
                New version
              </button>
            </div>
            {loading ? (
              <div className="admin-empty">Loading menu versions…</div>
            ) : (
              <form onSubmit={submit}>
                <label className="admin-field">
                  Effective from
                  <input
                    type="date"
                    required
                    value={validFrom}
                    onChange={(e) => {
                      setValidFrom(e.target.value);
                      setSelectedVersion("");
                    }}
                  />
                </label>
                <div className="meal-admin-table-head">
                  <span>Day</span>
                  <span>Morning snack</span>
                  <span>Hot-cooked meal</span>
                </div>
                {days.map((row) => (
                  <div className="meal-admin-row" key={row.day}>
                    <b>{row.day}</b>
                    {["breakfast", "lunch"].map((key) => (
                      <label key={key}>
                        <span>{key}</span>
                        <input
                          maxLength={500}
                          value={row[key]}
                          onChange={(e) => change(row.day, key, e.target.value)}
                          placeholder="Add menu item"
                        />
                      </label>
                    ))}
                  </div>
                ))}
                <button className="admin-submit" disabled={saving}>
                  {saving ? "Saving menu…" : "Publish menu"}
                </button>
              </form>
            )}
          </section>
          <aside className="admin-card meal-versions-card">
            <h2>
              Published versions <span>{versions.length}</span>
            </h2>
            {versions.length ? (
              versions.map((version) => (
                <button
                  key={version._id}
                  className={`meal-version-row ${selectedVersion === version._id ? "selected" : ""}`}
                  onClick={() => loadVersion(version)}
                >
                  <span>
                    <b>Menu from {dateLabel(version.validFrom)}</b>
                    <small>
                      {version.days?.filter(
                        (row) => row.breakfast || row.lunch || row.snacks,
                      ).length || 0}{" "}
                      days have menu items
                    </small>
                  </span>
                  <ArrowRight size={15} />
                </button>
              ))
            ) : (
              <div className="admin-empty">
                No menus published. Add the first weekly plan.
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function MealSlot({ label, value }) {
  return (
    <div className="meal-slot">
      <span>{label}</span>
      <b>{value || "Not listed"}</b>
    </div>
  );
}
