import { defineModel } from "./postgres.js";

export const User = defineModel("User", "users", {
  defaults: { centers: [], active: true },
  hideFields: ["passwordHash"],
});
export const Center = defineModel("Center", "centers", {
  defaults: { supervisors: [], status: "active" },
});
export const Child = defineModel("Child", "children", {
  defaults: { active: true, enrolledAt: new Date() },
});
export const Attendance = defineModel("Attendance", "attendances", {
  defaults: { records: [] },
});
export const Meal = defineModel("Meal", "meals", {
  defaults: {
    plannedQuantity: 0,
    distributedQuantity: 0,
    childrenServed: 0,
    completed: false,
  },
});
export const MealMenu = defineModel("MealMenu", "meal_menus", {
  defaults: { days: [] },
});
export const Growth = defineModel("Growth", "growth_records");
export const Activity = defineModel("Activity", "activities", {
  defaults: {
    participants: 0,
    assignedByAdmin: false,
    completed: false,
  },
});
export const StudentParticipation = defineModel(
  "StudentParticipation",
  "student_participations",
  { defaults: { category: "educational" } },
);
export const StudentAcademicResult = defineModel(
  "StudentAcademicResult",
  "student_academic_results",
);
export const Operation = defineModel("Operation", "operations", {
  defaults: {
    staffPresent: 0,
    foodStock: "adequate",
    suppliesAvailable: true,
    waterAvailable: true,
    electricityAvailable: true,
  },
});
export const Notice = defineModel("Notice", "notices", {
  defaults: { priority: "normal", receipts: [], scheduledAt: new Date() },
});
export const CalendarEvent = defineModel("CalendarEvent", "calendar_events", {
  defaults: { audience: "all", centers: [] },
});
export const Fund = defineModel("Fund", "funds", {
  defaults: { received: 0, spent: 0 },
});
export const AcademicProgress = defineModel(
  "AcademicProgress",
  "academic_progress",
  { defaults: { enrolled: 0, milestonesMet: 0, progressPercent: 0 } },
);

User.references.centers = { model: Center, many: true };
Center.references.worker = { model: User };
Center.references.supervisors = { model: User, many: true };
Child.references.center = { model: Center };
Attendance.references.center = { model: Center };
Attendance.references["records.child"] = { model: Child, many: true };
Growth.references.child = { model: Child };
Growth.references.center = { model: Center };
Activity.references.center = { model: Center };
Notice.references["receipts.center"] = { model: Center, many: true };
CalendarEvent.references.centers = { model: Center, many: true };
