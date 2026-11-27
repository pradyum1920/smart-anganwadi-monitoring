import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Home,
  UsersRound,
  ChartNoAxesColumnIncreasing,
  UserRound,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  CircleCheck,
  Circle,
  Utensils,
  Ruler,
  Star,
  Bell,
  CalendarDays,
  TrendingUp,
  Plus,
  Minus,
  Check,
  Menu,
  X,
  Building2,
  UserPlus,
  Sun,
  Moon,
  Search,
  Mic,
  Award,
  Eye,
  EyeOff,
  LockKeyhole,
  Heart,
  Sprout,
  LogOut,
  AlertCircle,
} from "lucide-react";
import "./style.css";
import "./admin.css";
import "./admin-dashboard.css";
import AdminDashboardView from "./AdminDashboardView.jsx";
import ReportsView from "./ReportsView.jsx";
import { DashboardFiltersProvider } from "./DashboardFiltersContext.jsx";
import StudentDashboardView from "./StudentDashboardView.jsx";
import { MealMenuView, AdminMealMenuView } from "./MealMenuView.jsx";

const initialKids = [
  { name: "Aarav Singh", rollNo: "001", initials: "A", present: true },
  { name: "Diya Kumari", rollNo: "002", initials: "D", present: true },
  { name: "Kabir Sharma", rollNo: "003", initials: "K", present: true },
  { name: "Meera Devi", rollNo: "004", initials: "M", present: false },
  { name: "Riya Yadav", rollNo: "005", initials: "R", present: true },
];

const navItems = [
  ["Home", Home],
  ["Children", UsersRound],
  ["Attendance", CalendarDays],
  ["Meal Menu", Utensils],
  ["Reports", ChartNoAxesColumnIncreasing],
];

const todayDateKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const dateKeyFromValue = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function App() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState("Home");
  const [pageHistory, setPageHistory] = useState([]);
  const [kids, setKids] = useState(initialKids);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [saved, setSaved] = useState("");
  const [menu, setMenu] = useState(false);

  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("anganwadi_theme") === "dark",
  );

  const [attendanceDate, setAttendanceDate] = useState(todayDateKey);
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [showAllKids, setShowAllKids] = useState(false);
  const [attendanceDone, setAttendanceDone] = useState(false);

  const [todayAttendance, setTodayAttendance] = useState({
    done: false,
    present: 0,
    absent: 0,
    total: 0,
  });
  const [mealDone, setMealDone] = useState(false);
  const [mealBusy, setMealBusy] = useState(false);
  const [todayActivity, setTodayActivity] = useState(null);
  const [activityBusy, setActivityBusy] = useState(false);

  const [token, setToken] = useState(
    () => localStorage.getItem("anganwadi_token") || "",
  );

  const [user, setUser] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loginEmail, setLoginEmail] = useState("administration");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginRole, setLoginRole] = useState("admin");
  const [loginCenter, setLoginCenter] = useState("");
  const [loginCenters, setLoginCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [centerName, setCenterName] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [activeChild, setActiveChild] = useState(null);
  const [growthHistory, setGrowthHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [studentsPageSchool, setStudentsPageSchool] = useState("all");
  const [signOutOpen, setSignOutOpen] = useState(false);

  const refreshLoginCenters = async () => {
    try {
      const response = await fetch("/api/auth/schools");
      const rows = await response.json();

      if (Array.isArray(rows)) {
        setLoginCenters(rows);

        setLoginCenter((current) =>
          rows.some((row) => row._id === current)
            ? current
            : rows[0]?._id || "",
        );
      }
    } catch {}
  };

  const syncCentersEverywhere = async () => {
    await refreshLoginCenters();

    try {
      setStats(await api("/dashboard"));
    } catch {}

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["calendar"] }),
      queryClient.invalidateQueries({ queryKey: ["notices"] }),
    ]);
  };

  useEffect(() => {
    refreshLoginCenters();
  }, []);

  useEffect(() => {
    localStorage.setItem("anganwadi_theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const api = async (path, options = {}) => {
    const response = await fetch(`/api${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Request failed");
    return data;
  };

  useEffect(() => {
    if (!token) return;

    api("/auth/me")
      .then(({ user: u }) => setUser(u))
      .catch(() => {
        localStorage.removeItem("anganwadi_token");
        setToken("");
        setUser(null);
      });
  }, [token]);

  useEffect(() => {
    if (!user) return;
    let alive = true;

    (async () => {
      try {
        const centers = await api("/centers");
        if (!alive) return;
        const selected = centers[0]?._id || centers[0]?.id;
        if (selected) setCenterId(selected);
        if (centers[0]?.name) setCenterName(centers[0].name);
        const today = todayDateKey();

        const [children, attendance, dashboard, meals, assigned] =
          await Promise.all([
            api("/children"),
            api(`/attendance?date=${today}`),
            api("/dashboard"),
            api("/meals"),
            api("/activities/today"),
          ]);

        if (!alive) return;
        setStats(dashboard);
        setTodayActivity(assigned?.latest || null);

        const savedAttendance = attendance.find(
          (a) => String(a.center?._id || a.center) === String(selected),
        );

        const isTodaySaved = !!savedAttendance?.records?.length;
        setAttendanceDone(isTodaySaved);

        const todayRecords = savedAttendance?.records || [];
        const todayPresentCount = todayRecords.filter(
          (r) => r.status === "present",
        ).length;
        const todayTotalCount = children.length;

        setTodayAttendance({
          done: isTodaySaved,
          present: todayPresentCount,
          absent: Math.max(0, todayTotalCount - todayPresentCount),
          total: todayTotalCount,
        });

        const savedMeal = meals.find(
          (m) =>
            String(m.center?._id || m.center) === String(selected) &&
            dateKeyFromValue(m.date) === today &&
            m.type === "lunch" &&
            m.completed,
        );

        setMealDone(!!savedMeal);

        const records = new Map(
          (savedAttendance?.records || []).map((r) => [
            String(r.child?._id || r.child),
            r.status,
          ]),
        );

        setKids(
          children.map((c, idx) => ({
            id: c._id || c.id,
            name: c.name,
            rollNo: c.rollNo || String(idx + 1).padStart(3, "0"),
            initials: c.name
              .split(/\s+/)
              .map((x) => x[0])
              .join("")
              .slice(0, 2),
            present: records.get(c._id || c.id) === "present",
          })),
        );

        if (children[0]) setActiveChild(children[0]);
      } catch (e) {
        action(e.message);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user || user.role === "admin") return;

    const timer = setInterval(() => {
      api("/activities/today")
        .then((assigned) => setTodayActivity(assigned?.latest || null))
        .catch(() => {});
    }, 10000);

    return () => clearInterval(timer);
  }, [user, token]);

  const activeChildId = activeChild?._id || activeChild?.id;

  useEffect(() => {
    if (!user || !activeChildId) return;
    let alive = true;
    setHeight("");
    setWeight("");
    setGrowthHistory([]);

    api(`/growth?child=${encodeURIComponent(activeChildId)}`)
      .then((rows) => {
        if (!alive || !Array.isArray(rows)) return;
        setGrowthHistory([...rows].slice(0, 6).reverse());
        if (rows[0]) {
          setHeight(rows[0].heightCm);
          setWeight(rows[0].weightKg);
        }
      })
      .catch((e) => {
        if (alive) action(e.message);
      });

    return () => {
      alive = false;
    };
  }, [user, activeChildId, token]);

  const present = kids.filter((k) => k.present).length;
  const changeAttendance = (i, v) =>
    setKids(kids.map((k, n) => (n === i ? { ...k, present: v } : k)));

  const login = async (e) => {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError("");

    try {
      const result = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify(
          loginRole === "admin"
            ? { username: loginEmail, password: loginPassword }
            : { centerId: loginCenter, password: loginPassword },
        ),
      });

      localStorage.setItem("anganwadi_token", result.token);
      setToken(result.token);
      setUser(result.user);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = () => setSignOutOpen(true);

  const confirmLogout = () => {
    localStorage.removeItem("anganwadi_token");
    setToken("");
    setUser(null);
    setKids(initialKids);
    setPage("Home");
    setPageHistory([]);
    setCenterId("");
    setCenterName("");
    setAttendanceDone(false);
    setTodayAttendance({ done: false, present: 0, absent: 0, total: 0 });
    setAttendanceSearch("");
    setTodayActivity(null);
    setSignOutOpen(false);
  };

  const saveAttendance = async () => {
    if (!token) {
      action("Sign in to save attendance");
      return;
    }

    try {
      await api("/attendance", {
        method: "PUT",
        body: JSON.stringify({
          center: centerId,
          date: attendanceDate,
          records: kids
            .filter((k) => k.id)
            .map((k) => ({
              child: k.id,
              status: k.present ? "present" : "absent",
            })),
        }),
      });

      const savedForToday = attendanceDate === todayDateKey();
      setAttendanceDone(savedForToday);

      if (savedForToday) {
        const presentCount = kids.filter((k) => k.present).length;
        setTodayAttendance({
          done: true,
          present: presentCount,
          absent: Math.max(0, kids.length - presentCount),
          total: kids.length,
        });
      }

      setStats(await api("/dashboard"));
      action("Attendance saved successfully");
    } catch (e) {
      action(e.message);
    }
  };

  const markMealDone = async () => {
    if (!token || mealBusy) return;
    setMealBusy(true);

    try {
      await api("/meals/today", {
        method: "PUT",
        body: JSON.stringify({ center: centerId }),
      });

      setMealDone(true);
      action("Meal marked done for today");
    } catch (e) {
      action(e.message);
    } finally {
      setMealBusy(false);
    }
  };

  const markActivityDone = async () => {
    if (!token || !todayActivity || todayActivity.completed || activityBusy)
      return;
    setActivityBusy(true);

    try {
      const updated = await api(`/activities/${todayActivity._id}/complete`, {
        method: "PUT",
        body: JSON.stringify({ completed: true }),
      });

      setTodayActivity(updated);
      action("Activity marked done for today");
    } catch (e) {
      action(e.message);
    } finally {
      setActivityBusy(false);
    }
  };

  const saveGrowth = async () => {
    const heightCm = Number(height);
    const weightKg = Number(weight);

    if (!token || !activeChild) {
      action("Choose a child and sign in to save measurements");
      return;
    }

    if (
      !Number.isFinite(heightCm) ||
      heightCm < 30 ||
      heightCm > 200 ||
      !Number.isFinite(weightKg) ||
      weightKg < 1 ||
      weightKg > 150
    ) {
      action("Enter a valid height and weight");
      return;
    }

    try {
      await api("/growth", {
        method: "POST",
        body: JSON.stringify({
          child: activeChild._id || activeChild.id,
          date: todayDateKey(),
          heightCm,
          weightKg,
        }),
      });

      const [dash, rows] = await Promise.all([
        api("/dashboard"),
        api(`/growth?child=${encodeURIComponent(activeChild._id || activeChild.id)}`),
      ]);
      setStats(dash);
      if (Array.isArray(rows)) setGrowthHistory([...rows].slice(0, 6).reverse());
      action("Health checkup saved to student record");
    } catch (e) {
      action(e.message);
    }
  };

  const action = (message) => {
    setSaved(message);
    setTimeout(() => setSaved(""), 2600);
  };

  const toggle = (p) => {
    if (p !== page) {
      setPageHistory((prev) => [...prev, page]);
    }
    setPage(p);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const canGoBack = pageHistory.length > 0 || page !== "Home";

  const goBack = () => {
    if (pageHistory.length > 0) {
      const previous = pageHistory[pageHistory.length - 1];
      setPageHistory((prev) => prev.slice(0, -1));
      setPage(previous);
    } else if (page !== "Home") {
      setPage("Home");
    }
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!user)
    return (
      <LoginScreen
        role={loginRole}
        setRole={setLoginRole}
        email={loginEmail}
        setEmail={setLoginEmail}
        password={loginPassword}
        setPassword={setLoginPassword}
        center={loginCenter}
        setCenter={setLoginCenter}
        centers={loginCenters}
        onSubmit={login}
        busy={authBusy}
        error={authError}
      />
    );

  if (user.role === "admin" && (page === "Users" || page === "Centers"))
    return (
      <>
        <AdminManagement
          page={page}
          token={token}
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode((v) => !v)}
          onBack={goBack}
          onLogout={logout}
          onCentersChanged={syncCentersEverywhere}
        />
        <SignOutDialog
          open={signOutOpen}
          onCancel={() => setSignOutOpen(false)}
          onConfirm={confirmLogout}
        />
      </>
    );

  if (user.role === "admin" && page === "Meals")
    return (
      <AdminMealMenuView
        token={token}
        darkMode={darkMode}
        onBack={goBack}
      />
    );

  if (user.role === "admin" && page === "Students")
    return (
      <AdminStudentList
        token={token}
        schoolId={studentsPageSchool}
        darkMode={darkMode}
        onBack={goBack}
        onStudentsChanged={syncCentersEverywhere}
      />
    );

  if (page === "Reports")
    return (
      <>
        <ReportsPageFrame
          user={user}
          token={token}
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode((v) => !v)}
          onNavigate={toggle}
          onBack={goBack}
          onLogout={logout}
        />
        <SignOutDialog
          open={signOutOpen}
          onCancel={() => setSignOutOpen(false)}
          onConfirm={confirmLogout}
        />
      </>
    );

  if (page === "Meal Menu" && user.role !== "admin")
    return (
      <>
        <MealMenuView
          user={user}
          token={token}
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode((v) => !v)}
          onNavigate={toggle}
          onBack={goBack}
          onLogout={logout}
        />
        <SignOutDialog
          open={signOutOpen}
          onCancel={() => setSignOutOpen(false)}
          onConfirm={confirmLogout}
        />
      </>
    );

  const visibleNav =
    user.role === "admin"
      ? [
          ["Dashboard", Home],
          ["Schools", Building2],
          ["Staff", UsersRound],
          ["Meal Menu", Utensils],
          ["Reports", ChartNoAxesColumnIncreasing],
        ]
      : navItems;

  const navTarget = (label) =>
    user.role === "admin"
      ? {
          Dashboard: "Home",
          Schools: "Centers",
          Staff: "Users",
          "Meal Menu": "Meals",
        }[label] || label
      : label;

  const todayLabel = now.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const fullDate = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const timeLabel = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const hour = now.getHours();

  const greeting =
    hour >= 5 && hour < 12
      ? "Good morning"
      : hour >= 12 && hour < 17
        ? "Good afternoon"
        : "Good evening";

  const schoolDisplayName =
    centerName || user.centers?.[0]?.name || "Your School";

  const todayAttendancePercent =
    todayAttendance.done && todayAttendance.total
      ? Math.round((todayAttendance.present / todayAttendance.total) * 100)
      : 0;

  const latestGrowthLabel = stats?.latestGrowthAt
    ? new Date(stats.latestGrowthAt).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "No report yet";

  if (page === "Children" && user.role !== "admin")
    return (
      <>
        <StudentDashboardView
          user={user}
          token={token}
          initialStudentId={activeChild?._id || activeChild?.id}
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode((v) => !v)}
          onNavigate={toggle}
          onBack={goBack}
          onLogout={logout}
        />
        <SignOutDialog
          open={signOutOpen}
          onCancel={() => setSignOutOpen(false)}
          onConfirm={confirmLogout}
        />
      </>
    );

  return (
    <>
      <div
        className={
          darkMode
            ? user.role === "admin"
              ? "app-shell dark-mode admin-role"
              : "app-shell dark-mode"
            : user.role === "admin"
              ? "app-shell admin-role"
              : "app-shell"
        }
      >
        <aside className={`sidebar ${menu ? "open" : ""}`}>
          <div className="brand">
            <div className="brand-icon">A</div>
            <div>
              <b>ANGANWADI</b>
              <small>CARE & GROW</small>
            </div>
            <button className="close-menu" onClick={() => setMenu(false)}>
              <X size={19} />
            </button>
          </div>
          <div className="center-chip">
            <span className="live-dot" />
            {user.role === "admin" ? user.name : schoolDisplayName}{" "}
            <ChevronDown size={15} />
          </div>
          <div className="side-label">WORKSPACE</div>
          {visibleNav.map(([label, Icon]) => (
            <button
              key={label}
              className={`side-link ${page === navTarget(label) ? "selected" : ""}`}
              onClick={() => toggle(navTarget(label))}
            >
              <Icon size={18} />
              {label}
              {label === "Reports" && <span className="side-count">3</span>}
            </button>
          ))}
          <button className="side-link" onClick={logout}>
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
        {menu && <div className="shade" onClick={() => setMenu(false)} />}
        <main className="main">
          <header className="topbar">
            <button className="menu-btn" onClick={() => setMenu(true)}>
              <Menu size={21} />
            </button>
            <div className="crumb">
              My workspace <span>/</span>{" "}
              {page === "Home" && user.role === "admin" ? "Dashboard" : page}
            </div>
            <div className="top-right">
              <div className="date-chip">
                <CalendarDays size={17} />
                <strong>{todayLabel}</strong>
              </div>
              <button
                className="notification"
                aria-label="Notifications"
                onClick={() =>
                  user.role === "admin"
                    ? action("Notifications")
                    : toggle("Notices")
                }
              >
                <Bell size={19} />
                {user.role !== "admin" && <NoticeUnreadBadge token={token} />}
              </button>
              <button
                className="theme-toggle"
                onClick={() => setDarkMode((v) => !v)}
                aria-label={`Switch theme`}
              >
                {darkMode ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <div className="avatar">
                {user.role === "admin" ? "A" : user.name?.[0]}
              </div>
              <button
                type="button"
                className="topbar-back-btn"
                onClick={goBack}
                disabled={!canGoBack}
                aria-label="Go back"
                title={canGoBack ? "Go back" : "Already on dashboard"}
              >
                <ArrowLeft size={15} />
                <span>Back</span>
              </button>
            </div>
          </header>
          {user.role !== "admin" && <SchoolUrgentBanner token={token} />}
          <div
            className={`content ${page === "Attendance" ? "attendance-page-content" : ""}`}
          >
            <div className="welcome-row">
              <div>
                <div className="eyebrow">
                  {fullDate.toUpperCase()} · {timeLabel.toUpperCase()}{" "}
                  <span className="live-dot" />
                </div>
                <h1>
                  {page === "Home"
                    ? user.role === "admin"
                      ? `${greeting}, Admin 👋`
                      : `${greeting}, ${schoolDisplayName}`
                    : page}
                </h1>
                <p className="subheading">
                  {user.role === "admin"
                    ? "Here’s what’s happening with your institution today."
                    : page === "Home"
                      ? "A little care goes a long way. Here’s your center today."
                      : "Your school dashboard and daily records."}
                </p>
              </div>
              <button
                className="primary-button"
                onClick={() => {
                  if (user.role === "admin") toggle("Centers");
                  else toggle("Attendance");
                }}
              >
                <Plus size={16} />{" "}
                {user.role === "admin" ? "Register school" : "Mark attendance"}{" "}
                <ArrowRight size={16} />
              </button>
            </div>
            {page !== "Attendance" && (
              <div
                className={`stats ${user.role === "admin" ? "" : "school-stats"}`}
              >
                {user.role === "admin" ? (
                  <>
                    <Stat
                      icon={UsersRound}
                      label="TOTAL ACTIVE STUDENTS"
                      value={stats?.children ?? 0}
                      suffix="across all schools"
                    />
                    <Stat
                      icon={UserRound}
                      label="TOTAL TEACHERS"
                      value={stats?.teachers ?? 0}
                      suffix="Anganwadi workers"
                    />
                    <Stat
                      icon={Building2}
                      label="TOTAL SCHOOLS"
                      value={stats?.centers ?? 0}
                      suffix="active schools"
                    />
                    <Stat
                      icon={UsersRound}
                      label="TOTAL STAFF"
                      value={stats?.staff ?? 0}
                      suffix="supervisors"
                      dark
                    />
                  </>
                ) : (
                  <>
                    <Stat
                      icon={UsersRound}
                      label="ENROLLED CHILDREN"
                      value={stats?.children ?? kids.length}
                      suffix="children"
                    />
                    <div className="stat-card stat-card-ring">
                      <div
                        className="mini-ring-gauge"
                        style={{ "--pct": `${todayAttendancePercent}%` }}
                      >
                        <span>
                          {todayAttendance.done
                            ? `${todayAttendancePercent}%`
                            : "—"}
                        </span>
                      </div>
                      <div className="stat-ring-copy">
                        <div className="eyebrow">TODAY'S ATTENDANCE</div>
                        <div className="stat-value">
                          {todayAttendance.done ? (
                            <>
                              {todayAttendance.present}
                              <span> / {todayAttendance.total}</span>
                            </>
                          ) : (
                            "Not done"
                          )}
                        </div>
                        <small className="stat-ring-sub">
                          {todayAttendance.done
                            ? `${todayAttendance.present} present · ${todayAttendance.absent} absent`
                            : "Attendance not done for today"}
                        </small>
                      </div>
                    </div>
                    <Stat
                      icon={TrendingUp}
                      label="GROWTH CHECKS"
                      value={stats?.growthChecksThisMonth ?? 0}
                      suffix="this month"
                    />
                  </>
                )}
              </div>
            )}
            {user.role === "admin" ? (
              <AdminDashboardView
                stats={stats}
                latestGrowthLabel={latestGrowthLabel}
                token={token}
                onViewStudents={(id) => {
                  setStudentsPageSchool(id);
                  toggle("Students");
                }}
                onReports={() => toggle("Reports")}
              />
            ) : page === "Attendance" ? (
              <section
                className="card kids-card attendance-page-card"
                id="school-attendance"
              >
                <div className="card-heading">
                  <div>
                    <div className="eyebrow">DAILY ATTENDANCE</div>
                    <h2>Who is here?</h2>
                  </div>
                  <label className="attendance-date-label">
                    Date
                    <input
                      type="date"
                      value={attendanceDate}
                      onChange={async (e) => {
                        const date = e.target.value;
                        setAttendanceDate(date);
                        setAttendanceDone(false);
                        if (!date || !token) return;

                        try {
                          const rows = await api(`/attendance?date=${date}`);

                          const record = rows.find(
                            (a) =>
                              String(a.center?._id || a.center) ===
                              String(centerId),
                          );

                          setAttendanceDone(
                            date === todayDateKey() &&
                              !!record?.records?.length,
                          );

                          const statuses = new Map(
                            (record?.records || []).map((r) => [
                              String(r.child?._id || r.child),
                              r.status,
                            ]),
                          );

                          setKids((current) =>
                            current.map((k) => ({
                              ...k,
                              present: statuses.get(k.id) === "present",
                            })),
                          );
                        } catch (err) {
                          action(err.message);
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="attendance-summary">
                  <div>
                    <b>{present}</b>
                    <small>Present</small>
                  </div>
                  <div>
                    <b>{kids.length - present}</b>
                    <small>Absent</small>
                  </div>
                  <div>
                    <b>
                      {kids.length
                        ? Math.round((present / kids.length) * 100)
                        : 0}
                      %
                    </b>
                    <small>Attendance</small>
                  </div>
                </div>
                <div className="attendance-toolbar">
                  <label className="attendance-search">
                    <Search size={15} />
                    <input
                      type="search"
                      placeholder="Search student by name…"
                      value={attendanceSearch}
                      onChange={(e) => setAttendanceSearch(e.target.value)}
                    />
                  </label>
                  <div className="attendance-bulk-actions">
                    <button
                      type="button"
                      className="check-action"
                      onClick={() =>
                        setKids((current) =>
                          current.map((k) => ({ ...k, present: true })),
                        )
                      }
                    >
                      Mark all present
                    </button>
                    <button
                      type="button"
                      className="check-action"
                      onClick={() =>
                        setKids((current) =>
                          current.map((k) => ({ ...k, present: false })),
                        )
                      }
                    >
                      Mark all absent
                    </button>
                  </div>
                </div>
                {(() => {
                  const query = attendanceSearch.trim().toLowerCase();
                  const indexedKids = kids
                    .map((kid, index) => ({ kid, index }))
                    .filter(
                      ({ kid }) =>
                        !query || kid.name.toLowerCase().includes(query),
                    );
                  const visibleKids =
                    query || showAllKids
                      ? indexedKids
                      : indexedKids.slice(0, 10);

                  return (
                    <>
                      <div className="kids-list">
                        {visibleKids.length ? (
                          visibleKids.map(({ kid, index }) => (
                            <div
                              className={`kid-row ${!kid.present ? "absent" : ""}`}
                              key={kid.id || kid.name + index}
                            >
                              <div className="avatar child-avatar">
                                {kid.initials}
                              </div>
                              <div className="kid-info">
                                <b>{kid.name}</b>
                                <small>
                                  Roll No:{" "}
                                  {kid.rollNo ||
                                    String(index + 1).padStart(3, "0")}
                                </small>
                              </div>
                              <button
                                className={`status-button ${kid.present ? "is-present" : "is-absent"}`}
                                onClick={() =>
                                  changeAttendance(index, !kid.present)
                                }
                              >
                                {kid.present ? "Present" : "Absent"}
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="admin-empty">
                            No students match your search.
                          </div>
                        )}
                      </div>
                      {!query && indexedKids.length > 10 && (
                        <button
                          className="text-link"
                          onClick={() => setShowAllKids((v) => !v)}
                        >
                          {showAllKids
                            ? "View less"
                            : `View more (${indexedKids.length - 10} more)`}
                        </button>
                      )}
                    </>
                  );
                })()}
                <button className="save-attendance" onClick={saveAttendance}>
                  Save attendance <ArrowRight size={16} />
                </button>
              </section>
            ) : (
              <div className="dashboard-grid">
                <section className="card attendance-card">
                  <div className="card-heading">
                    <div>
                      <div className="eyebrow">TODAY'S CHECK-IN</div>
                      <h2>Today at the center</h2>
                    </div>
                    <button
                      className="text-link"
                      onClick={() => toggle("Attendance")}
                    >
                      Attendance <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="checkin-split">
                    <div className="checkin-ring-panel">
                      <div
                        className={`checkin-ring-gauge ${todayAttendance.done ? "" : "is-pending"}`}
                        style={{ "--pct": `${todayAttendancePercent}%` }}
                      >
                        <div className="checkin-ring-inner">
                          {todayAttendance.done ? (
                            <>
                              <b>
                                {todayAttendance.present}
                                <span>/{todayAttendance.total}</span>
                              </b>
                              <small>
                                {todayAttendance.present} present,
                                <br />
                                {todayAttendance.absent} absent
                              </small>
                            </>
                          ) : (
                            <>
                              <b>Not done</b>
                              <small>
                                Mark attendance
                                <br />
                                for today
                              </small>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="checklist checkin-checklist">
                      <div className="check-row">
                        <span
                          className={
                            todayAttendance.done ? "check-done" : "check-empty"
                          }
                        >
                          {todayAttendance.done ? <Check size={12} /> : null}
                        </span>
                        <span className="check-activity-text">
                          <span className={todayAttendance.done ? "done" : ""}>
                            {todayAttendance.done
                              ? "Attendance done for today"
                              : "Attendance not done for today"}
                          </span>
                          <small className="check-activity-meta">
                            {todayAttendance.done
                              ? `(${todayAttendance.present} present, ${todayAttendance.absent} absent)`
                              : "Open Attendance to mark students"}
                          </small>
                        </span>
                        <button
                          className="check-action"
                          onClick={() => toggle("Attendance")}
                        >
                          {todayAttendance.done ? "Edit" : "Mark now"}
                        </button>
                      </div>
                      <div className="check-row">
                        <span
                          className={mealDone ? "check-done" : "check-empty"}
                        >
                          {mealDone ? <Check size={12} /> : null}
                        </span>
                        <span className={mealDone ? "done" : ""}>
                          Meal {mealDone ? "done" : "not marked"} for today
                        </span>
                        <button
                          className="check-action"
                          disabled={mealDone || mealBusy}
                          onClick={markMealDone}
                        >
                          {mealDone
                            ? "Done"
                            : mealBusy
                              ? "Saving…"
                              : "Mark done"}
                        </button>
                      </div>
                      <div className="check-row check-row-activity">
                        <span
                          className={
                            todayActivity?.completed
                              ? "check-done"
                              : "check-empty"
                          }
                        >
                          {todayActivity?.completed ? (
                            <Check size={12} />
                          ) : null}
                        </span>
                        <span className="check-activity-text">
                          <span
                            className={todayActivity?.completed ? "done" : ""}
                          >
                            {todayActivity
                              ? `Activity: ${todayActivity.title}`
                              : "No activity punched by Administration today"}
                          </span>
                          {todayActivity && (
                            <small className="check-activity-meta">
                              Assigned by Administration
                              {todayActivity.description
                                ? ` · ${todayActivity.description}`
                                : ""}
                            </small>
                          )}
                        </span>
                        <button
                          className="check-action"
                          disabled={
                            !todayActivity ||
                            todayActivity.completed ||
                            activityBusy
                          }
                          onClick={markActivityDone}
                        >
                          {!todayActivity
                            ? "Waiting"
                            : todayActivity.completed
                              ? "Done"
                              : activityBusy
                                ? "Saving…"
                                : "Mark done"}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="card-footer">
                    <span>
                      <span className="live-dot" />{" "}
                      {todayAttendance.done &&
                      mealDone &&
                      (!todayActivity || todayActivity.completed)
                        ? "Today’s attendance, meal, and activity are recorded"
                        : "Update attendance, meal, and activity for today"}
                    </span>
                    <button onClick={() => toggle("Attendance")}>
                      Attendance list <ArrowRight size={14} />
                    </button>
                  </div>
                </section>
                <section className="card growth-card">
                  <div className="card-heading">
                    <div>
                      <div className="eyebrow">GROWTH MONITORING</div>
                      <h2>A small step, a healthy future</h2>
                    </div>
                    <button
                      className="more-button"
                      onClick={() => toggle("Children")}
                    >
                      •••
                    </button>
                  </div>
                  <select
                    className="child-select"
                    value={activeChild?._id || activeChild?.id || ""}
                    onChange={(e) => {
                      const c = kids.find((k) => k.id === e.target.value);
                      if (c) setActiveChild({ _id: c.id, name: c.name });
                    }}
                    aria-label="Select child"
                  >
                    <option value="">Select a child</option>
                    {kids
                      .filter((k) => k.id)
                      .map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name}
                        </option>
                      ))}
                  </select>
                  <div className="measurements">
                    <Measure
                      label="Height"
                      value={height}
                      unit="cm"
                      min={30}
                      max={200}
                      onChange={setHeight}
                    />
                    <Measure
                      label="Weight"
                      value={weight}
                      unit="kg"
                      min={1}
                      max={150}
                      onChange={setWeight}
                    />
                  </div>
                  <div className="chart-title">
                    <b>Weight history</b>
                    <small>
                      {growthHistory.length
                        ? `Last ${growthHistory.length} checkup${growthHistory.length === 1 ? "" : "s"}`
                        : "No checkups yet"}
                    </small>
                  </div>
                  {(() => {
                    if (!growthHistory.length) {
                      return (
                        <div className="dashboard-empty">
                          Save a measurement above to start tracking{" "}
                          {activeChild?.name || "this child"}'s weight history.
                        </div>
                      );
                    }

                    const weights = growthHistory.map((r) => Number(r.weightKg) || 0);
                    const rawMin = Math.min(...weights);
                    const rawMax = Math.max(...weights);
                    const minW = Math.max(0, Math.floor(rawMin - 1));
                    const maxW = Math.max(minW + 2, Math.ceil(rawMax + 1));
                    const midW = ((minW + maxW) / 2).toFixed(1);

                    const points = growthHistory.map((row, idx) => {
                      const x =
                        growthHistory.length === 1
                          ? 220
                          : 16 +
                            (idx * (424 - 16)) / (growthHistory.length - 1);
                      const ratio =
                        (Number(row.weightKg) - minW) / (maxW - minW);
                      const y = Number((100 - ratio * 80).toFixed(1));
                      const label = new Date(row.date).toLocaleDateString(
                        "en",
                        { month: "short", day: "numeric" },
                      );
                      return { x: Number(x.toFixed(1)), y, label, w: row.weightKg };
                    });

                    const pathD = points
                      .map((p, idx) => `${idx === 0 ? "M" : "L"}${p.x} ${p.y}`)
                      .join(" ");

                    return (
                      <div className="chart">
                        <div className="chart-y">
                          <span>{maxW} kg</span>
                          <span>{midW} kg</span>
                          <span>{minW} kg</span>
                        </div>
                        <svg
                          viewBox="0 0 440 120"
                          preserveAspectRatio="none"
                          aria-label="Weight history chart"
                        >
                          <defs>
                            <linearGradient
                              id="weightAreaGrad"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#5a8f6f"
                                stopOpacity="0.34"
                              />
                              <stop
                                offset="100%"
                                stopColor="#5a8f6f"
                                stopOpacity="0.03"
                              />
                            </linearGradient>
                          </defs>
                          <path
                            className="chart-grid"
                            d="M0 20H440 M0 60H440 M0 100H440"
                          />
                          {points.length > 1 && (
                            <>
                              <path
                                d={`${pathD} L${points[points.length - 1].x} 100 L${points[0].x} 100 Z`}
                                fill="url(#weightAreaGrad)"
                              />
                              <path className="chart-line" d={pathD} />
                            </>
                          )}
                          {points.map((p, idx) => (
                            <circle
                              key={p.label + idx}
                              className={
                                idx === points.length - 1 ? "last-dot" : ""
                              }
                              cx={p.x}
                              cy={p.y}
                              r={idx === points.length - 1 ? 6 : 4}
                            >
                              <title>
                                {p.label}: {p.w} kg
                              </title>
                            </circle>
                          ))}
                        </svg>
                        <div className="chart-x">
                          {points.map((p, idx) => (
                            <span key={p.label + idx}>{p.label}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  <div className="insight">
                    <span>✳</span>
                    <p>
                      <b>Steady progress.</b> Record each child's height and
                      weight monthly. Measurements are for monitoring and are
                      not a diagnosis.
                    </p>
                  </div>
                  <button className="save-measure" onClick={saveGrowth}>
                    Save measurement <ArrowRight size={16} />
                  </button>
                </section>
                <section className="card overview-card">
                  <div className="card-heading">
                    <div>
                      <div className="eyebrow">A LITTLE LOOK BACK</div>
                      <h2>Your center is growing</h2>
                    </div>
                    <span className="month-tag">
                      This week <ChevronDown size={13} />
                    </span>
                  </div>
                  <div className="overview-metrics">
                    <div>
                      <b>86%</b>
                      <small>Attendance</small>
                    </div>
                    <div>
                      <b>
                        24<span>/28</span>
                      </b>
                      <small>Reports in</small>
                    </div>
                    <div>
                      <b>5</b>
                      <small>Needs attention</small>
                    </div>
                  </div>
                  <div className="mini-chart-head">
                    <b>Attendance this week</b>
                    <small>+8% this week</small>
                  </div>
                  <div className="bar-chart">
                    {[
                      ["Mon", 68],
                      ["Tue", 72],
                      ["Wed", 61],
                      ["Thu", 83],
                      ["Fri", 75],
                      ["Sat", 48],
                      ["Sun", 8],
                    ].map(([d, h], i) => (
                      <div className="bar-col" key={d}>
                        <div
                          className={`bar ${i === 5 ? "bar-warn" : ""}`}
                          style={{ height: `${h}%` }}
                        />
                        <small>{d}</small>
                      </div>
                    ))}
                  </div>
                  <div className="alerts-title">
                    <b>Centers needing attention</b>
                    <button
                      className="text-link"
                      onClick={() => toggle("Alerts")}
                    >
                      See all
                    </button>
                  </div>
                  <Alert
                    n="07"
                    title="Center 07"
                    detail="Daily report not submitted"
                    tag="Missing"
                    tone="amber"
                  />
                  <Alert
                    n="15"
                    title="Center 15"
                    detail="Attendance below 75% · 3 repeat absences"
                    tag="Low"
                    tone="amber"
                  />
                  <Alert
                    n="18"
                    title="Center 18"
                    detail="2 growth records to review"
                    tag="Growth"
                    tone="green"
                  />
                </section>
                <SchoolNoticePanel token={token} />
              </div>
            )}
            <footer className="page-footer">
              <span>
                Made with care for little beginnings{" "}
                <span className="heart">♥</span>
              </span>
              <span>
                {user.role === "admin"
                  ? "All registered schools"
                  : user.centers?.[0]?.name || "Your school"}{" "}
                <i /> Data saved securely
              </span>
            </footer>
          </div>
          <nav className="mobile-nav">
            {visibleNav.map(([label, Icon]) => (
              <button
                key={label}
                className={page === navTarget(label) ? "active" : ""}
                onClick={() => toggle(navTarget(label))}
              >
                <Icon size={19} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          {saved && (
            <div className="toast">
              <CircleCheck size={18} />
              {saved}
            </div>
          )}
        </main>
      </div>
      <SignOutDialog
        open={signOutOpen}
        onCancel={() => setSignOutOpen(false)}
        onConfirm={confirmLogout}
      />
    </>
  );
}

function AdminManagement({
  page,
  token,
  darkMode,
  onToggleTheme,
  onBack,
  onLogout,
  onCentersChanged,
}) {
  const [centers, setCenters] = useState([]);
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [centerStatusDrafts, setCenterStatusDrafts] = useState({});
  const [savingCenter, setSavingCenter] = useState("");
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schoolStatusFilter, setSchoolStatusFilter] = useState("all");
  const [staffSearch, setStaffSearch] = useState("");
  const [staffRoleFilter, setStaffRoleFilter] = useState("all");

  const [centerForm, setCenterForm] = useState({
    name: "",
    centerId: "",
    village: "",
    district: "",
    state: "",
  });

  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "worker",
    center: "",
  });

  const call = async (path, options = {}) => {
    const r = await fetch(`/api${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.message || "Request failed");
    return data;
  };

  const refresh = async () => {
    try {
      const c = await call("/centers");
      setCenters(c);

      setCenterStatusDrafts(
        Object.fromEntries(
          c.map((center) => [center._id, center.status || "active"]),
        ),
      );

      const activeCenters = c.filter((center) => center.status === "active");

      if (
        !activeCenters.some((center) => center._id === userForm.center) &&
        activeCenters[0]
      )
        setUserForm((v) => ({ ...v, center: activeCenters[0]._id }));

      if (page === "Users") setUsers(await call("/users"));
    } catch (e) {
      setError(e.message);
    }
  };

  const pendingCenters = centers.filter(
    (center) =>
      (centerStatusDrafts[center._id] || center.status || "active") !==
      (center.status || "active"),
  );

  const activeSchoolCount = centers.filter(
    (center) =>
      (centerStatusDrafts[center._id] || center.status || "active") ===
      "active",
  ).length;

  const filteredCenters = centers.filter((center) => {
    const draftStatus =
      centerStatusDrafts[center._id] || center.status || "active";
    const matchesFilter =
      schoolStatusFilter === "all" || draftStatus === schoolStatusFilter;
    const query = schoolSearch.trim().toLowerCase();
    const matchesSearch =
      !query ||
      `${center.name} ${center.centerId || ""} ${center.village || ""} ${center.district || ""} ${center.state || ""}`
        .toLowerCase()
        .includes(query);
    return matchesFilter && matchesSearch;
  });

  const workerCount = users.filter((u) => u.role === "worker").length;
  const supervisorCount = users.filter((u) => u.role === "supervisor").length;

  const filteredUsers = users.filter((u) => {
    const matchesRole =
      staffRoleFilter === "all" || u.role === staffRoleFilter;
    const query = staffSearch.trim().toLowerCase();
    const centerNames = (u.centers || []).map((c) => c?.name || "").join(" ");
    const matchesSearch =
      !query ||
      `${u.name || ""} ${u.email || ""} ${u.role || ""} ${centerNames}`
        .toLowerCase()
        .includes(query);
    return matchesRole && matchesSearch;
  });

  const selectedStaffCenter = centers.find((c) => c._id === userForm.center);

  useEffect(() => {
    refresh();
  }, [page]);

  const submitCenter = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      await call("/centers", {
        method: "POST",
        body: JSON.stringify(centerForm),
      });

      setCenterForm({
        name: "",
        centerId: "",
        village: "",
        district: "",
        state: "",
      });

      setMessage(
        "Center created. You can now assign a worker or supervisor to it.",
      );

      await refresh();
      await onCentersChanged?.();
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleCenterStatus = (center) => {
    const current = centerStatusDrafts[center._id] || center.status || "active";

    setCenterStatusDrafts((v) => ({
      ...v,
      [center._id]: current === "active" ? "inactive" : "active",
    }));

    setError("");
    setMessage("");
  };

  const saveCenterStatuses = async () => {
    if (!pendingCenters.length || savingCenter) return;
    setError("");
    setMessage("");
    setSavingCenter("all");

    const results = await Promise.allSettled(
      pendingCenters.map((center) =>
        call(`/centers/${center._id}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: centerStatusDrafts[center._id] || center.status || "active",
          }),
        }),
      ),
    );

    const failedCenters = pendingCenters.filter(
      (_, index) => results[index].status === "rejected",
    );

    await refresh();

    if (failedCenters.length)
      setCenterStatusDrafts((current) => ({
        ...current,
        ...Object.fromEntries(
          failedCenters.map((center) => [
            center._id,
            centerStatusDrafts[center._id],
          ]),
        ),
      }));

    await onCentersChanged?.();

    if (failedCenters.length)
      setError(
        `${failedCenters.length} centre status change${failedCenters.length === 1 ? "" : "s"} could not be saved. Please retry.`,
      );
    else setMessage("All centre status changes saved and synced.");

    setSavingCenter("");
  };

  const submitUser = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (userForm.role !== "admin" && !userForm.center) {
      setError("Create a center before adding a worker or supervisor.");
      return;
    }

    try {
      await call("/users", {
        method: "POST",
        body: JSON.stringify({
          name: userForm.name,
          email: userForm.email,
          password: userForm.password,
          role: userForm.role,
          centers: userForm.center ? [userForm.center] : [],
        }),
      });

      setMessage(
        `${userForm.role} account created. Share the sign-in details with them securely.`,
      );

      setUserForm((v) => ({ ...v, name: "", email: "", password: "" }));
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className={darkMode ? "admin-page dark-mode" : "admin-page"}>
      <header className="admin-top">
        <div className="brand">
          <div className="brand-icon">A</div>
          <div>
            <b>ANGANWADI</b>
            <small>CARE & GROW</small>
          </div>
        </div>
        <div className="admin-top-actions">
          <button onClick={onToggleTheme}>
            {darkMode ? <Sun size={16} /> : <Moon size={16} />} Theme
          </button>
          <button onClick={onBack}>
            <ArrowLeft size={16} /> Back to dashboard
          </button>
          <button onClick={onLogout}>Sign out</button>
        </div>
      </header>
      <main className="admin-content school-setup-content">
        <div className="school-setup-hero">
          <div className="school-setup-badge">
            {page === "Centers" ? (
              <Building2 size={14} />
            ) : (
              <UsersRound size={14} />
            )}
            {page === "Centers"
              ? "SCHOOL MANAGEMENT · SETUP"
              : "STAFF MANAGEMENT · TEAM SETUP"}
          </div>
          <h1>
            {page === "Centers"
              ? "Set up your schools"
              : "Add a team member"}
          </h1>
          <p className="admin-intro">
            {page === "Centers"
              ? "Register Anganwadi schools, keep details organized, and manage active centers from one place."
              : "Create worker, supervisor, and administrator accounts and assign them to active schools."}
          </p>
          <div className="school-setup-stats">
            {page === "Centers" ? (
              <>
                <div className="school-setup-stat">
                  <strong>{centers.length}</strong>
                  <span>Total schools</span>
                </div>
                <div className="school-setup-stat">
                  <strong>{activeSchoolCount}</strong>
                  <span>Active schools</span>
                </div>
                <div className="school-setup-stat">
                  <strong>{pendingCenters.length}</strong>
                  <span>Pending edits</span>
                </div>
              </>
            ) : (
              <>
                <div className="school-setup-stat">
                  <strong>{users.length}</strong>
                  <span>Total staff</span>
                </div>
                <div className="school-setup-stat">
                  <strong>{workerCount}</strong>
                  <span>Workers</span>
                </div>
                <div className="school-setup-stat">
                  <strong>{supervisorCount}</strong>
                  <span>Supervisors</span>
                </div>
              </>
            )}
          </div>
        </div>
        {error && (
          <div className="admin-alert error school-setup-alert">{error}</div>
        )}
        {message && (
          <div className="admin-alert success school-setup-alert">{message}</div>
        )}
        {page === "Centers" ? (
          <div className="school-setup-stack">
            <section className="admin-card school-setup-form-card">
              <div className="school-card-header">
                <div className="school-card-icon">
                  <Sprout size={18} />
                </div>
                <div>
                  <h2>Register a new school</h2>
                  <p>
                    Add your school details below so workers and supervisors can
                    be assigned.
                  </p>
                </div>
              </div>
              {(centerForm.name.trim() || centerForm.centerId.trim()) && (
                <div className="school-live-preview">
                  <div className="management-icon">
                    <Building2 size={16} />
                  </div>
                  <div>
                    <b>{centerForm.name.trim() || "School name preview"}</b>
                    <small>
                      {centerForm.centerId.trim() || "Center ID"} ·{" "}
                      {[
                        centerForm.village.trim(),
                        centerForm.district.trim(),
                        centerForm.state.trim(),
                      ]
                        .filter(Boolean)
                        .join(", ") || "Location details"}
                    </small>
                  </div>
                  <span className="center-status is-active">Preview</span>
                </div>
              )}
              <form onSubmit={submitCenter}>
                <div className="form-row">
                  <AdminField
                    label="School / Center name"
                    value={centerForm.name}
                    required
                    onChange={(v) => setCenterForm({ ...centerForm, name: v })}
                  />
                  <AdminField
                    label="School / Center ID"
                    value={centerForm.centerId}
                    required
                    onChange={(v) =>
                      setCenterForm({ ...centerForm, centerId: v })
                    }
                  />
                </div>
                <div className="school-location-grid">
                  <AdminField
                    label="Village / Area"
                    value={centerForm.village}
                    onChange={(v) =>
                      setCenterForm({ ...centerForm, village: v })
                    }
                  />
                  <AdminField
                    label="District"
                    value={centerForm.district}
                    onChange={(v) =>
                      setCenterForm({ ...centerForm, district: v })
                    }
                  />
                  <AdminField
                    label="State"
                    value={centerForm.state}
                    onChange={(v) => setCenterForm({ ...centerForm, state: v })}
                  />
                </div>
                <button className="admin-submit school-setup-submit">
                  <Plus size={16} /> Add school
                </button>
              </form>
            </section>
            <section className="admin-card school-setup-list-card">
              <h2 className="center-list-heading">
                Registered schools <span>{centers.length}</span>
                <button
                  className="center-save-button center-save-all"
                  type="button"
                  disabled={!pendingCenters.length || savingCenter === "all"}
                  onClick={saveCenterStatuses}
                >
                  {savingCenter === "all"
                    ? "Saving…"
                    : `Save changes${pendingCenters.length ? ` (${pendingCenters.length})` : ""}`}
                </button>
              </h2>
              <div className="school-filter-bar">
                <label className="school-search-input">
                  <Search size={15} />
                  <input
                    type="search"
                    placeholder="Search by school name, ID, or village…"
                    value={schoolSearch}
                    onChange={(e) => setSchoolSearch(e.target.value)}
                  />
                </label>
                <div className="school-filter-pills" role="group" aria-label="Filter schools by status">
                  {[
                    ["all", "All"],
                    ["active", "Active"],
                    ["inactive", "Inactive"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={schoolStatusFilter === value ? "active" : ""}
                      onClick={() => setSchoolStatusFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {filteredCenters.length ? (
                <div className="school-list-rows">
                  {filteredCenters.map((c) => {
                    const draftStatus =
                      centerStatusDrafts[c._id] || c.status || "active";
                    const unsaved = draftStatus !== (c.status || "active");
                    const location = [c.village, c.district, c.state]
                      .filter(Boolean)
                      .join(", ");

                    return (
                      <div className="management-row school-row" key={c._id}>
                        <div className="management-icon">
                          <Building2 size={17} />
                        </div>
                        <div>
                          <b>{c.name}</b>
                          <small>
                            {c.centerId} · {location || "Location not set"}
                          </small>
                        </div>
                        <span
                          className={`center-status ${draftStatus === "active" ? "is-active" : "is-inactive"}`}
                        >
                          {draftStatus === "active" ? "Active" : "Inactive"}
                          {unsaved ? " · Unsaved" : ""}
                        </span>
                        <button
                          className="center-status-toggle"
                          type="button"
                          onClick={() => toggleCenterStatus(c)}
                        >
                          {draftStatus === "active"
                            ? "Set inactive"
                            : "Set active"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="admin-empty">
                  {centers.length
                    ? "No schools match your current search or filter."
                    : "No schools yet. Add your first school above to get started."}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="school-setup-stack">
            <section className="admin-card school-setup-form-card">
              <div className="school-card-header">
                <div className="school-card-icon">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h2>Register a team member</h2>
                  <p>
                    Set up sign-in credentials and assign their role and active
                    school.
                  </p>
                </div>
              </div>
              {(userForm.name.trim() || userForm.email.trim()) && (
                <div className="school-live-preview">
                  <div className="avatar child-avatar">
                    {(userForm.name.trim()[0] || "S").toUpperCase()}
                  </div>
                  <div>
                    <b>{userForm.name.trim() || "Staff member preview"}</b>
                    <small>
                      {userForm.email.trim() || "Email address"} ·{" "}
                      {userForm.role}
                      {userForm.role !== "admin" && selectedStaffCenter
                        ? ` · ${selectedStaffCenter.name}`
                        : ""}
                    </small>
                  </div>
                  <span className="center-status is-active">Preview</span>
                </div>
              )}
              <form onSubmit={submitUser}>
                <div className="form-row">
                  <AdminField
                    label="Full name"
                    value={userForm.name}
                    required
                    onChange={(v) => setUserForm({ ...userForm, name: v })}
                  />
                  <AdminField
                    label="Email address"
                    type="email"
                    value={userForm.email}
                    required
                    onChange={(v) => setUserForm({ ...userForm, email: v })}
                  />
                </div>
                <div className="form-row">
                  <AdminField
                    label="Temporary password · 10+ characters"
                    type="password"
                    minLength={10}
                    required
                    value={userForm.password}
                    onChange={(v) => setUserForm({ ...userForm, password: v })}
                  />
                  <label className="admin-field">
                    Role
                    <select
                      value={userForm.role}
                      onChange={(e) =>
                        setUserForm({ ...userForm, role: e.target.value })
                      }
                    >
                      <option value="worker">Anganwadi worker</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </label>
                </div>
                {userForm.role !== "admin" && (
                  <label className="admin-field">
                    Assigned center
                    <select
                      required
                      value={userForm.center}
                      onChange={(e) =>
                        setUserForm({ ...userForm, center: e.target.value })
                      }
                    >
                      <option value="">Choose a center</option>
                      {centers
                        .filter((c) => c.status === "active")
                        .map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name} · {c.centerId}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <button className="admin-submit school-setup-submit">
                  <UserPlus size={16} /> Create account
                </button>
              </form>
            </section>
            <section className="admin-card school-setup-list-card">
              <h2>
                Team accounts <span>{users.length}</span>
              </h2>
              <div className="school-filter-bar">
                <label className="school-search-input">
                  <Search size={15} />
                  <input
                    type="search"
                    placeholder="Search by name, email, or school…"
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                  />
                </label>
                <div
                  className="school-filter-pills"
                  role="group"
                  aria-label="Filter staff by role"
                >
                  {[
                    ["all", "All"],
                    ["worker", "Workers"],
                    ["supervisor", "Supervisors"],
                    ["admin", "Admins"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={staffRoleFilter === value ? "active" : ""}
                      onClick={() => setStaffRoleFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {filteredUsers.length ? (
                <div className="school-list-rows">
                  {filteredUsers.map((u) => {
                    const centerName = u.centers?.[0]?.name;

                    return (
                      <div className="management-row school-row" key={u._id}>
                        <div className="avatar child-avatar">
                          {(u.name?.[0] || "U").toUpperCase()}
                        </div>
                        <div>
                          <b>{u.name}</b>
                          <small>
                            {u.email}
                            {centerName ? ` · ${centerName}` : ""}
                          </small>
                        </div>
                        <span
                          className={`staff-role-chip role-${u.role || "worker"}`}
                        >
                          {u.role}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="admin-empty">
                  {users.length
                    ? "No team accounts match your current search or filter."
                    : "No team accounts found."}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function ReportsPageFrame({
  user,
  token,
  darkMode,
  onToggleTheme,
  onNavigate,
  onBack,
  onLogout,
}) {
  const admin = user.role === "admin";

  const links = admin
    ? [
        ["Home", Home],
        ["Centers", Building2],
        ["Users", UsersRound],
        ["Meal Menu", Utensils],
        ["Reports", ChartNoAxesColumnIncreasing],
      ]
    : [
        ["Home", Home],
        ["Children", UsersRound],
        ["Attendance", CalendarDays],
        ["Meal Menu", Utensils],
        ["Reports", ChartNoAxesColumnIncreasing],
      ];

  const date = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div
      className={
        darkMode ? "app-shell dark-mode admin-role" : "app-shell admin-role"
      }
    >
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
          {admin ? "Administration" : user.centers?.[0]?.name || user.name}
          <ChevronDown size={15} />
        </div>
        <div className="side-label">WORKSPACE</div>
        {links.map(([label, Icon]) => (
          <button
            key={label}
            className={`side-link ${label === "Reports" ? "selected" : ""}`}
            onClick={() =>
              onNavigate(
                label === "Home"
                  ? "Home"
                  : admin && label === "Centers"
                    ? "Centers"
                    : admin && label === "Meal Menu"
                      ? "Meals"
                      : label,
              )
            }
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
          <div className="avatar small">{user.name?.[0] || "A"}</div>
          <div>
            <b>{user.name}</b>
            <small>{user.role}</small>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="crumb">
            My workspace <span>/</span> Reports
          </div>
          <div className="top-right">
            <div className="date-chip">
              <CalendarDays size={17} />
              <strong>{date}</strong>
            </div>
            <button
              className="theme-toggle"
              onClick={onToggleTheme}
              aria-label="Switch theme"
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <div className="avatar">{admin ? "A" : user.name?.[0]}</div>
            <button
              type="button"
              className="topbar-back-btn"
              onClick={onBack}
              aria-label="Go back"
            >
              <ArrowLeft size={15} />
              <span>Back</span>
            </button>
          </div>
        </header>
        <div className="content reports-content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">SCHOOL INSIGHTS</div>
              <h1>Reports</h1>
              <p className="subheading">
                Review enrolment, funds, attendance, and school activities.
              </p>
            </div>
          </div>
          <ReportsView token={token} user={user} />
        </div>
      </main>
    </div>
  );
}

function useSchoolNotices(token) {
  return useQuery({
    queryKey: ["school-notices", token],
    queryFn: async () => {
      const response = await fetch("/api/notices/recent", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const body = await response.json();
      if (!response.ok)
        throw new Error(body.message || "Could not load notices");
      return body;
    },
    enabled: !!token,
    refetchInterval: 15000,
  });
}

function NoticeUnreadBadge({ token }) {
  const query = useSchoolNotices(token);
  const unread = (query.data || []).filter((n) => !n.read).length;

  return unread > 0 ? (
    <span className="notice-unread-count">{unread > 9 ? "9+" : unread}</span>
  ) : null;
}

function SchoolUrgentBanner({ token }) {
  const query = useSchoolNotices(token);
  const notice = (query.data || []).find(
    (n) => n.priority === "urgent" && !n.read,
  );

  return notice ? (
    <button
      className="school-urgent-banner"
      onClick={() =>
        document
          .getElementById("school-notices")
          ?.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    >
      <AlertCircle size={17} />
      <span>
        <b>Urgent notice: {notice.title}</b>
        <small>{notice.message}</small>
      </span>
      <ArrowRight size={15} />
    </button>
  ) : null;
}

function SchoolNoticePanel({ token }) {
  const query = useSchoolNotices(token);
  const client = useQueryClient();
  const [active, setActive] = useState(null);
  const notices = query.data || [];

  const markRead = async (notice) => {
    setActive(notice);
    if (notice.read) return;

    const response = await fetch(`/api/notices/${notice._id}/read`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok)
      client.invalidateQueries({ queryKey: ["school-notices", token] });
  };

  return (
    <section className="card school-notices-panel" id="school-notices">
      <div className="card-heading">
        <div>
          <div className="eyebrow">UPDATES FROM ADMINISTRATION</div>
          <h2>Notices</h2>
        </div>
        <Bell size={18} />
      </div>
      {query.isLoading ? (
        <div className="dashboard-skeleton notice-loading" />
      ) : query.error ? (
        <div className="report-error">{query.error.message}</div>
      ) : notices.length ? (
        notices.slice(0, 5).map((notice) => (
          <button
            className={`school-notice-row ${notice.read ? "read" : ""}`}
            key={notice._id}
            onClick={() => markRead(notice)}
          >
            <span className={`priority-dot ${notice.priority}`} />
            <span>
              <b>{notice.title}</b>
              <small>
                {new Date(notice.scheduledAt).toLocaleDateString()} ·{" "}
                {notice.message}
              </small>
            </span>
            {!notice.read && <i className="notice-new-dot" />}
          </button>
        ))
      ) : (
        <div className="notice-empty">No notices for your school.</div>
      )}
      {active && (
        <div className="school-notice-detail">
          <button
            className="notice-close"
            aria-label="Close notice"
            onClick={() => setActive(null)}
          >
            <X size={14} />
          </button>
          <span className={`priority-chip ${active.priority}`}>
            {active.priority}
          </span>
          <h3>{active.title}</h3>
          <p>{active.message}</p>
          {active.attachment?.data && (
            <a href={active.attachment.data} target="_blank" rel="noreferrer">
              {active.attachment.name || "View attachment"}
            </a>
          )}
        </div>
      )}
    </section>
  );
}

function AdminStudentList({
  token,
  schoolId,
  darkMode,
  onBack,
  onStudentsChanged,
}) {
  const [state, setState] = useState({
    rows: [],
    schools: [],
    school: "",
    error: "",
    loading: true,
  });

  const [studentForm, setStudentForm] = useState({
    name: "",
    dateOfBirth: "2022-05-15",
    gender: "female",
    guardianName: "",
    guardianPhone: "",
    address: "",
    center: schoolId && schoolId !== "all" ? schoolId : "",
  });

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");

  const loadStudents = async () => {
    const headers = { Authorization: `Bearer ${token}` };

    const [children, schools] = await Promise.all([
      fetch(
        `/api/children${schoolId === "all" ? "" : `?center=${encodeURIComponent(schoolId)}`}`,
        { headers },
      ).then((r) => r.json()),
      fetch("/api/dashboard/schools", { headers }).then((r) => r.json()),
    ]);

    const schoolList = Array.isArray(schools) ? schools : [];

    setState({
      rows: Array.isArray(children) ? children : [],
      schools: schoolList,
      school: schoolList.find((s) => s._id === schoolId)?.name || "All schools",
      error: "",
      loading: false,
    });

    setStudentForm((current) => ({
      ...current,
      center:
        current.center && schoolList.some((s) => s._id === current.center)
          ? current.center
          : schoolId !== "all" && schoolList.some((s) => s._id === schoolId)
            ? schoolId
            : schoolList[0]?._id || "",
    }));
  };

  useEffect(() => {
    let live = true;

    loadStudents().catch((e) => {
      if (live) setState((v) => ({ ...v, error: e.message, loading: false }));
    });

    return () => {
      live = false;
    };
  }, [token, schoolId]);

  const submitStudent = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess("");
    setState((v) => ({ ...v, error: "" }));

    try {
      const response = await fetch("/api/children", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(studentForm),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.message || "Could not add student.");

      setStudentForm((v) => ({
        ...v,
        name: "",
        guardianName: "",
        guardianPhone: "",
        address: "",
      }));

      setSuccess(`${body.name || "Student"} enrolled and saved to MongoDB.`);
      await loadStudents();
      await onStudentsChanged?.();
    } catch (err) {
      setState((v) => ({ ...v, error: err.message }));
    } finally {
      setSaving(false);
    }
  };

  const filteredRows = state.rows.filter((child) => {
    const matchesGender =
      genderFilter === "all" || child.gender === genderFilter;
    const query = search.trim().toLowerCase();
    const matchesQuery =
      !query ||
      `${child.name || ""} ${child.guardianName || ""} ${child.center?.name || ""}`
        .toLowerCase()
        .includes(query);
    return matchesGender && matchesQuery;
  });

  const girlsCount = state.rows.filter((c) => c.gender === "female").length;
  const boysCount = state.rows.filter((c) => c.gender === "male").length;

  return (
    <div className={darkMode ? "admin-page dark-mode" : "admin-page"}>
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
            <ArrowLeft size={16} /> Back to dashboard
          </button>
        </div>
      </header>
      <main className="admin-content school-setup-content">
        <div className="school-setup-hero">
          <div className="school-setup-badge">
            <UsersRound size={14} />
            STUDENT DIRECTORY · ENROLMENT
          </div>
          <h1>{state.school} students</h1>
          <p className="admin-intro">
            Enroll new students directly into any active school and browse the
            live directory.
          </p>
          <div className="school-setup-stats">
            <div className="school-setup-stat">
              <strong>{state.rows.length}</strong>
              <span>Total students</span>
            </div>
            <div className="school-setup-stat">
              <strong>{girlsCount}</strong>
              <span>Girls</span>
            </div>
            <div className="school-setup-stat">
              <strong>{boysCount}</strong>
              <span>Boys</span>
            </div>
          </div>
        </div>
        {state.error && (
          <div className="admin-alert error school-setup-alert">
            {state.error}
          </div>
        )}
        {success && (
          <div className="admin-alert success school-setup-alert">
            {success}
          </div>
        )}
        <div className="school-setup-stack">
          <section className="admin-card school-setup-form-card">
            <div className="school-card-header">
              <div className="school-card-icon">
                <UserPlus size={18} />
              </div>
              <div>
                <h2>Enroll a new student</h2>
                <p>
                  Enter the child and guardian details below to save immediately
                  in MongoDB.
                </p>
              </div>
            </div>
            <form onSubmit={submitStudent}>
              <div className="form-row">
                <AdminField
                  label="Student full name"
                  value={studentForm.name}
                  required
                  onChange={(v) => setStudentForm({ ...studentForm, name: v })}
                />
                <label className="admin-field">
                  School / Center
                  <select
                    required
                    value={studentForm.center}
                    onChange={(e) =>
                      setStudentForm({ ...studentForm, center: e.target.value })
                    }
                  >
                    <option value="">Choose a school</option>
                    {state.schools.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.centerId})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="school-location-grid">
                <AdminField
                  label="Date of birth"
                  type="date"
                  required
                  value={studentForm.dateOfBirth}
                  onChange={(v) =>
                    setStudentForm({ ...studentForm, dateOfBirth: v })
                  }
                />
                <label className="admin-field">
                  Gender
                  <select
                    value={studentForm.gender}
                    onChange={(e) =>
                      setStudentForm({ ...studentForm, gender: e.target.value })
                    }
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <AdminField
                  label="Guardian phone"
                  value={studentForm.guardianPhone}
                  onChange={(v) =>
                    setStudentForm({ ...studentForm, guardianPhone: v })
                  }
                />
              </div>
              <div className="form-row">
                <AdminField
                  label="Guardian name"
                  value={studentForm.guardianName}
                  onChange={(v) =>
                    setStudentForm({ ...studentForm, guardianName: v })
                  }
                />
                <AdminField
                  label="Home address"
                  value={studentForm.address}
                  onChange={(v) =>
                    setStudentForm({ ...studentForm, address: v })
                  }
                />
              </div>
              <button
                className="admin-submit school-setup-submit"
                disabled={saving}
              >
                <Plus size={16} /> {saving ? "Adding student…" : "Add student"}
              </button>
            </form>
          </section>
          <section className="admin-card school-setup-list-card">
            <h2>
              Registered students <span>{state.rows.length}</span>
            </h2>
            <div className="school-filter-bar">
              <label className="school-search-input">
                <Search size={15} />
                <input
                  type="search"
                  placeholder="Search by student, guardian, or school…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <div
                className="school-filter-pills"
                role="group"
                aria-label="Filter students by gender"
              >
                {[
                  ["all", "All"],
                  ["female", "Girls"],
                  ["male", "Boys"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={genderFilter === value ? "active" : ""}
                    onClick={() => setGenderFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {state.loading ? (
              <div className="admin-empty">Loading students…</div>
            ) : filteredRows.length ? (
              <div className="school-list-rows">
                {filteredRows.map((child, idx) => (
                  <div className="management-row school-row" key={child._id}>
                    <div className="avatar child-avatar">{child.name?.[0]}</div>
                    <div>
                      <b>{child.name}</b>
                      <small>
                        Roll No:{" "}
                        {child.rollNo || String(idx + 1).padStart(3, "0")} ·{" "}
                        {child.center?.name || "Assigned center"}
                        {child.guardianName
                          ? ` · Guardian: ${child.guardianName}`
                          : ""}
                      </small>
                    </div>
                    <span
                      className={`staff-role-chip ${child.gender === "female" ? "role-worker" : "role-supervisor"}`}
                    >
                      {child.gender}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="admin-empty">
                {state.rows.length
                  ? "No students match your search or filter."
                  : "No students registered yet."}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function AdminField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  minLength,
}) {
  return (
    <label className="admin-field">
      {label}
      <input
        type={type}
        value={value}
        required={required}
        minLength={minLength}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function SignOutDialog({ open, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div
      className="signout-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        className="signout-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="signout-title"
        aria-describedby="signout-description"
      >
        <button
          className="signout-close"
          type="button"
          aria-label="Cancel sign out"
          onClick={onCancel}
        >
          <X size={18} />
        </button>
        <div className="signout-mark">
          <LogOut size={22} />
        </div>
        <div className="signout-eyebrow">ANGANWADI WORKSPACE</div>
        <h2 id="signout-title">Sign out?</h2>
        <p id="signout-description">
          You’ll need to sign in again to continue your work.
        </p>
        <div className="signout-actions">
          <button className="signout-cancel" type="button" onClick={onCancel}>
            Stay signed in
          </button>
          <button className="signout-confirm" type="button" onClick={onConfirm}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </section>
    </div>
  );
}

function AuthHeroPanel() {
  return (
    <section className="login-brand-panel">
      <img
        className="login-hero-image"
        src="/anganwadi-login-hero.png"
        alt="Anganwadi care and learning hero illustration"
      />
      <div className="login-compact-brand">
        <div className="login-brand">
          <div className="brand-icon">A</div>
          <div>
            <b>ANGANWADI</b>
            <small>CARE &amp; GROW</small>
          </div>
        </div>
        <h2>
          Growing brighter
          <br />
          futures, one child
          <br />
          at a time.
        </h2>
      </div>
    </section>
  );
}

function LoginScreen({
  role,
  setRole,
  email,
  setEmail,
  password,
  setPassword,
  center,
  setCenter,
  centers,
  onSubmit,
  busy,
  error,
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="login-page">
      <AuthHeroPanel />
      <section className="login-side">
        <svg
          className="login-side-tree"
          viewBox="0 0 140 210"
          aria-hidden="true"
        >
          <path
            d="M70 205c-4-43 9-67 1-106M69 142c-21-15-31-31-39-52m42 42c22-17 33-37 39-62m-39 13c-15-18-19-33-21-52m24 37c18-12 27-26 34-44"
            fill="none"
            stroke="#8b6846"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <g fill="#5f8b55">
            <circle cx="31" cy="76" r="22" />
            <circle cx="48" cy="51" r="24" />
            <circle cx="77" cy="47" r="27" />
            <circle cx="105" cy="61" r="24" />
            <circle cx="111" cy="89" r="20" />
            <circle cx="77" cy="80" r="25" />
          </g>
          <g fill="#83a96a">
            <circle cx="35" cy="69" r="10" />
            <circle cx="63" cy="43" r="11" />
            <circle cx="96" cy="57" r="10" />
            <circle cx="81" cy="78" r="9" />
          </g>
          <path
            d="M42 204h58"
            stroke="#a5ad62"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </svg>
        <section className="login-card">
          <div className="eyebrow">SMART ANGANWADI MONITORING</div>
          <div className="login-rays" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <h1>Welcome back.</h1>
          <p>Choose how you'd like to sign in.</p>
          <div className="login-roles">
            <button
              type="button"
              className={role === "admin" ? "active" : ""}
              onClick={() => setRole("admin")}
            >
              <Building2 size={16} /> Administration
            </button>
            <button
              type="button"
              className={role === "school" ? "active" : ""}
              onClick={() => setRole("school")}
            >
              <Home size={16} /> School
            </button>
          </div>
          <form onSubmit={onSubmit}>
            {role === "admin" ? (
              <label>
                Username
                <div className="login-input-wrap">
                  <UserRound size={17} />
                  <input
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your username"
                  />
                </div>
              </label>
            ) : (
              <label>
                Select your school
                <div className="login-input-wrap">
                  <Home size={17} />
                  <select
                    required
                    value={center}
                    onChange={(e) => setCenter(e.target.value)}
                  >
                    <option value="">Choose a registered school</option>
                    {centers.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            )}
            <label>
              Password
              <div className="login-password-wrap">
                <LockKeyhole className="login-field-icon" size={17} />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="password-visibility"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}
            <button className="save-attendance" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"} <ArrowRight size={16} />
            </button>
          </form>
        </section>
        <div className="login-bottom">
          A little care goes a long way <span>&hearts;</span>
        </div>
      </section>
    </main>
  );
}

function Stat({ icon: Icon, label, value, suffix, dateValue, dark }) {
  return (
    <div className={`stat-card ${dark ? "dark-stat" : ""}`}>
      <div className="stat-icon">
        <Icon size={17} />
      </div>
      <div className="eyebrow">{label}</div>
      <div className={`stat-value ${dateValue ? "date-value" : ""}`}>
        {value}
        <small>{suffix}</small>
      </div>
    </div>
  );
}

function Measure({ label, value, unit, min, max, onChange }) {
  return (
    <label className="measure measure-edit">
      <small>{label}</small>
      <div className="measure-input-row">
        <input
          type="number"
          min={min}
          max={max}
          step="0.1"
          inputMode="decimal"
          value={value}
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : Number(e.target.value))
          }
          aria-label={`${label} in ${unit}`}
        />
        <span>{unit}</span>
      </div>
    </label>
  );
}

function Alert({ n, title, detail, tag, tone }) {
  return (
    <div className="alert-row">
      <span className="alert-num">{n}</span>
      <div>
        <b>{title}</b>
        <small>{detail}</small>
      </div>
      <span className={`tag ${tone}`}>{tag}</span>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: true },
  },
});

createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={queryClient}>
    <DashboardFiltersProvider>
      <App />
    </DashboardFiltersProvider>
  </QueryClientProvider>,
);
