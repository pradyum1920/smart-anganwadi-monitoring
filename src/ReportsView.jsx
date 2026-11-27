import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  TrendingUp,
  CalendarDays,
  Utensils,
  ArrowRight,
  BookOpenCheck,
  Soup,
} from "lucide-react";
import { SchoolSelect, Donut } from "./ReportWidgets.jsx";

async function request(path, token) {
  const response = await fetch(`/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Could not load report");
  return data;
}

function CardState({ query, children }) {
  if (query.isLoading)
    return <div className="dashboard-skeleton report-skeleton" />;

  if (query.error)
    return (
      <div className="report-error">
        {query.error.message}
        <button onClick={() => query.refetch()}>Retry</button>
      </div>
    );

  return children;
}

function AcademicChart({ points }) {
  if (!points?.length)
    return (
      <div className="dashboard-empty">
        No academic progression records yet.
      </div>
    );

  const width = 420;
  const height = 190;
  const pad = 24;
  const max = 100;
  const min = 40;

  const coords = points.map((p, i) => ({
    x: pad + (i * (width - 2 * pad)) / Math.max(1, points.length - 1),
    y:
      height -
      pad -
      ((p.progressPercent - min) / (max - min)) * (height - 2 * pad),
  }));

  const line = coords.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ");
  const area = `${line} L${coords.at(-1).x} ${height - pad} L${coords[0].x} ${height - pad} Z`;

  return (
    <div className="academic-chart-wrap">
      <div className="chart-legend">
        <span>
          <i className="girl-dot" /> Children meeting learning milestones
        </span>
      </div>
      <svg
        className="academic-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Academic progression over recent years"
      >
        <defs>
          <linearGradient id="academicFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#86cf70" stopOpacity=".4" />
            <stop offset="1" stopColor="#86cf70" stopOpacity=".03" />
          </linearGradient>
        </defs>
        {[40, 60, 80, 100].map((value) => (
          <g key={value}>
            <line
              x1={pad}
              x2={width - pad}
              y1={
                height -
                pad -
                ((value - min) / (max - min)) * (height - 2 * pad)
              }
              y2={
                height -
                pad -
                ((value - min) / (max - min)) * (height - 2 * pad)
              }
              className="report-grid-line"
            />
            <text
              x={2}
              y={
                height -
                pad -
                ((value - min) / (max - min)) * (height - 2 * pad) +
                3
              }
              className="academic-y-label"
            >
              {value}%
            </text>
          </g>
        ))}
        <path d={area} fill="url(#academicFill)" />
        <path d={line} className="academic-progress-line" />
        {coords.map((point, index) => (
          <g key={points[index].year}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4.5"
              className="academic-point"
            >
              <title>
                {points[index].year}: {points[index].progressPercent}% (
                {points[index].milestonesMet} of {points[index].enrolled}{" "}
                children met milestones)
              </title>
            </circle>
            <text
              x={point.x}
              y={height - 3}
              textAnchor="middle"
              className="fund-month-label"
            >
              {points[index].year}
            </text>
          </g>
        ))}
      </svg>
      <div className="academic-chart-caption">
        Progress in children meeting age-appropriate learning milestones
      </div>
    </div>
  );
}

function MealChart({ data }) {
  const days = data?.days || [];
  const max = Math.max(1, ...days.map((day) => day.childrenServed));

  return (
    <>
      <div className="meal-report-summary">
        <div>
          <b>{(data?.totalPortions || 0).toLocaleString()}</b>
          <small>Portions served</small>
        </div>
        <div>
          <b>{(data?.childrenServed || 0).toLocaleString()}</b>
          <small>Children served</small>
        </div>
      </div>
      {days.length ? (
        <div className="meal-report-bars">
          {days.map((day) => (
            <div
              className={`meal-report-day ${!day.recorded ? "no-data-day" : ""}`}
              key={day.date}
              title={`${day.date}${day.recorded ? ` · ${day.childrenServed} children served · ${day.distributed} portions` : " · No meal report"}`}
            >
              <div className="meal-report-bar">
                {day.recorded ? (
                  <i
                    style={{
                      height: `${Math.max(8, (day.childrenServed / max) * 100)}%`,
                    }}
                  />
                ) : (
                  <em />
                )}
              </div>
              <small>
                {new Date(`${day.date}T00:00:00`).toLocaleDateString(
                  undefined,
                  { weekday: "short", day: "numeric" },
                )}
              </small>
            </div>
          ))}
        </div>
      ) : (
        <div className="dashboard-empty meal-empty">
          No mid-day meal records for this period.
        </div>
      )}
      <div className="meal-report-caption">
        Mid-day meal service in the selected period
      </div>
    </>
  );
}

export default function ReportsView({ token, user }) {
  const [school, setSchool] = useState(() => {
    const id = new URLSearchParams(location.search).get("school") || "";
    return id === "all" ? "" : id;
  });

  const [period, setPeriod] = useState(
    () => new URLSearchParams(location.search).get("range") || "7d",
  );

  const [age, setAge] = useState("all");

  const [from, setFrom] = useState(
    () => new URLSearchParams(location.search).get("from") || "",
  );

  const [to, setTo] = useState(
    () => new URLSearchParams(location.search).get("to") || "",
  );

  const [showAll, setShowAll] = useState(false);
  const isAdmin = user?.role === "admin";
  const ownSchool = user?.centers?.[0]?._id || user?.centers?.[0] || "";
  const schoolId = isAdmin ? school : ownSchool;

  useEffect(() => {
    const url = new URL(location.href);
    if (school) url.searchParams.set("school", school);
    else url.searchParams.delete("school");
    url.searchParams.set("range", period);

    if (period === "custom" && from && to) {
      url.searchParams.set("from", from);
      url.searchParams.set("to", to);
    } else {
      url.searchParams.delete("from");
      url.searchParams.delete("to");
    }

    history.replaceState({}, "", url);
  }, [school, period, from, to]);

  const schoolQuery = useQuery({
    queryKey: ["dashboard", "schools"],
    queryFn: () =>
      request(isAdmin ? "/dashboard/schools" : "/auth/schools", token),
    enabled: !!token,
    staleTime: 300000,
  });

  const validCustom = period === "custom" && !!from && !!to;

  const params =
    period === "custom"
      ? `range=custom&from=${from}&to=${to}`
      : `range=${period}`;

  const enabled = !!token && !!schoolId && (period !== "custom" || validCustom);

  const students = useQuery({
    queryKey: ["reports", schoolId, "students", age, period, from, to],
    queryFn: () =>
      request(
        `/reports/school/${schoolId}/students?age=${age}&period=${period}`,
        token,
      ),
    enabled,
  });

  const academics = useQuery({
    queryKey: ["reports", schoolId, "academics", period],
    queryFn: () =>
      request(`/reports/school/${schoolId}/academics?years=4`, token),
    enabled,
  });

  const attendance = useQuery({
    queryKey: ["reports", schoolId, "attendance", period, from, to],
    queryFn: () =>
      request(`/reports/school/${schoolId}/attendance?${params}`, token),
    enabled,
  });

  const activities = useQuery({
    queryKey: ["reports", schoolId, "activities", period, from, to],
    queryFn: () =>
      request(`/reports/school/${schoolId}/activities?${params}`, token),
    enabled,
  });

  const meals = useQuery({
    queryKey: ["reports", schoolId, "meals", period, from, to],
    queryFn: () =>
      request(`/reports/school/${schoolId}/meals?${params}`, token),
    enabled,
  });

  const schools = schoolQuery.data || [];
  const selected = schools.find((item) => item._id === schoolId);
  const reportsLoaded = !!schoolId;

  return (
    <div className="reports-page">
      <div className="reports-toolbar">
        <div className="reports-filters">
          {isAdmin ? (
            <SchoolSelect
              schools={schools}
              value={school}
              onChange={setSchool}
              label="Select school"
              all={false}
              loading={schoolQuery.isLoading}
            />
          ) : (
            <div className="locked-school-select" title="Your assigned school">
              {user?.centers?.[0]?.name || selected?.name || "Your school"}{" "}
              <span>Locked</span>
            </div>
          )}
          {schoolQuery.isError && (
            <small className="school-list-error">
              {schoolQuery.error.message}
            </small>
          )}
          <select
            aria-label="Report period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="month">This month</option>
            <option value="custom">Custom range</option>
          </select>
          {period === "custom" && (
            <>
              <input
                aria-label="Start date"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <input
                aria-label="End date"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </>
          )}
        </div>
        <button className="report-download" onClick={() => window.print()}>
          <Download size={15} /> Download PDF
        </button>
      </div>
      {!reportsLoaded ? (
        <div className="reports-empty-state">
          Select a school to view its report.
        </div>
      ) : period === "custom" && !validCustom ? (
        <div className="reports-empty-state">
          Choose a valid custom date range to load this report.
        </div>
      ) : (
        <div className="report-card-grid">
          <section className="card report-card">
            <div className="card-heading">
              <div>
                <div className="eyebrow">ENROLMENT</div>
                <h2>Students</h2>
              </div>
              <select
                aria-label="Students age group"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              >
                <option value="all">All ages</option>
                <option value="0-3">0–3 years</option>
                <option value="3-6">3–6 years</option>
              </select>
            </div>
            <CardState query={students}>
              {students.data?.total ? (
                <>
                  <Donut data={students.data} />
                  <div className="report-donut-caption">
                    Girls and boys enrolled at this school
                  </div>
                </>
              ) : (
                <div className="dashboard-empty">
                  No students registered yet.
                </div>
              )}
            </CardState>
          </section>
          <section className="card report-card">
            <div className="card-heading">
              <div>
                <div className="eyebrow">LEARNING OUTCOMES</div>
                <h2>Academic progression</h2>
              </div>
              <span className="academic-year-tag">Last 4 years</span>
            </div>
            <CardState query={academics}>
              <AcademicChart points={academics.data} />
            </CardState>
          </section>
          <section className="card report-card">
            <div className="card-heading">
              <div>
                <div className="eyebrow">DAILY RECORDS</div>
                <h2>Attendance</h2>
              </div>
              <select
                aria-label="Attendance period"
                value={period === "7d" ? "weekly" : "monthly"}
                onChange={(e) =>
                  setPeriod(e.target.value === "weekly" ? "7d" : "30d")
                }
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <CardState query={attendance}>
              <div className="chart-legend">
                <span>
                  <i className="girl-dot" /> Present
                </span>
                <span>
                  <i className="boy-dot" /> Absent
                </span>
                <span>No data</span>
              </div>
              <div className="report-attendance-bars">
                {(attendance.data || []).map((day) => {
                  const total = day.present + day.absent;

                  return (
                    <div
                      className={`report-attendance-day ${!day.recorded ? "no-data-day" : ""}`}
                      key={day.date}
                      title={`${day.date}${day.recorded ? ` · Present: ${total ? Math.round((day.present / total) * 100) : 0}% · Absent: ${total ? Math.round((day.absent / total) * 100) : 0}%` : " · No data"}`}
                    >
                      <div className="report-stack-bar">
                        {day.recorded ? (
                          <>
                            <i
                              style={{
                                height: `${total ? (day.present / total) * 100 : 0}%`,
                              }}
                            />
                            <b
                              style={{
                                height: `${total ? (day.absent / total) * 100 : 0}%`,
                              }}
                            />
                          </>
                        ) : (
                          <em />
                        )}
                      </div>
                      <small>
                        {new Date(`${day.date}T00:00:00`).toLocaleDateString(
                          undefined,
                          { weekday: "short", day: "numeric" },
                        )}
                      </small>
                    </div>
                  );
                })}
              </div>
            </CardState>
          </section>
          <section className="card report-card">
            <div className="card-heading">
              <div>
                <div className="eyebrow">SCHOOL ACTIVITIES</div>
                <h2>Activities</h2>
              </div>
              <button
                className="text-link"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? "Show less" : "View all"} <ArrowRight size={14} />
              </button>
            </div>
            <CardState query={activities}>
              <div className="report-activities">
                {(activities.data?.items || [])
                  .slice(0, showAll ? 99 : 5)
                  .map((item) => (
                    <div className="report-activity" key={item._id}>
                      <span className="activity-icon">
                        {item.category === "health" ? (
                          <Utensils size={15} />
                        ) : item.category === "physical" ? (
                          <TrendingUp size={15} />
                        ) : (
                          <BookOpenCheck size={15} />
                        )}
                      </span>
                      <div>
                        <b>{item.title}</b>
                        <small>
                          {item.description || "School activity recorded."}
                        </small>
                      </div>
                      <time>
                        {new Date(item.date).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                        })}
                        <br />
                        {new Date(item.date).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                  ))}
                {!activities.data?.items?.length && (
                  <div className="dashboard-empty">
                    No activities in this period.
                  </div>
                )}
              </div>
              <div className="report-activity-footer">
                {activities.data?.completed || 0} of{" "}
                {activities.data?.assigned || 8} assigned activities completed
              </div>
            </CardState>
          </section>
          <section className="card report-card">
            <div className="card-heading">
              <div>
                <div className="eyebrow">NUTRITION PROGRAMME</div>
                <h2>Mid-day meal report</h2>
              </div>
              <Soup size={18} />
            </div>
            <CardState query={meals}>
              <MealChart data={meals.data} />
            </CardState>
          </section>
        </div>
      )}
    </div>
  );
}
