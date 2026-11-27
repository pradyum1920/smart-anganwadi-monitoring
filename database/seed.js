import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "./postgres.js";
import bcrypt from "bcryptjs";
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

const STUDENTS_PER_SCHOOL = 100;

const sampleSchools = [
  {
    name: "Green Valley Anganwadi",
    centerId: "AW-01",
    village: "Rampur",
    block: "North Block",
    district: "Lucknow",
    state: "Uttar Pradesh",
    address: "Plot 12, Rampur Main Road, North Block, Lucknow",
  },
  {
    name: "Sunrise Child Centre",
    centerId: "AW-02",
    village: "Lakshmipur",
    block: "East Block",
    district: "Lucknow",
    state: "Uttar Pradesh",
    address: "Near Primary School, Lakshmipur, East Block, Lucknow",
  },
  {
    name: "Little Steps Anganwadi",
    centerId: "AW-03",
    village: "Basantpur",
    block: "South Block",
    district: "Kanpur",
    state: "Uttar Pradesh",
    address: "Ward 4, Basantpur Colony, South Block, Kanpur",
  },
  {
    name: "Saraswati Balwadi",
    centerId: "AW-04",
    village: "Kalyanpur",
    block: "West Block",
    district: "Kanpur",
    state: "Uttar Pradesh",
    address: "Temple Road, Kalyanpur, West Block, Kanpur",
  },
  {
    name: "Rainbow Care Centre",
    centerId: "AW-05",
    village: "Shivnagar",
    block: "Central Block",
    district: "Varanasi",
    state: "Uttar Pradesh",
    address: "Sector 2, Shivnagar, Central Block, Varanasi",
  },
];

const girlFirstNames = [
  "Anaya",
  "Diya",
  "Isha",
  "Meera",
  "Saanvi",
  "Aditi",
  "Kavya",
  "Tara",
  "Myra",
  "Nisha",
  "Riya",
  "Anjali",
  "Pooja",
  "Sneha",
  "Priya",
  "Khushi",
  "Nandini",
  "Aarohi",
  "Palak",
  "Shruti",
];

const boyFirstNames = [
  "Aarav",
  "Vivaan",
  "Aditya",
  "Arjun",
  "Kabir",
  "Rohan",
  "Ishaan",
  "Reyansh",
  "Krishna",
  "Dev",
  "Vihaan",
  "Atharv",
  "Siddharth",
  "Yash",
  "Kunal",
  "Manav",
  "Pranav",
  "Shaurya",
  "Harsh",
  "Nikhil",
];

const guardianFirstNames = [
  "Rajesh",
  "Sunita",
  "Ramesh",
  "Geeta",
  "Suresh",
  "Kavita",
  "Mahesh",
  "Anita",
  "Dinesh",
  "Meena",
  "Mukesh",
  "Rekha",
  "Vinod",
  "Seema",
  "Prakash",
  "Kiran",
];

const lastNames = [
  "Sharma",
  "Singh",
  "Kumari",
  "Patel",
  "Yadav",
  "Devi",
  "Gupta",
  "Verma",
  "Das",
  "Rao",
  "Mishra",
  "Tiwari",
];

const participationTemplates = [
  {
    title: "Storytelling & Picture Reading",
    category: "educational",
    remarks: "Actively participated and identified story characters.",
  },
  {
    title: "Morning Yoga & Outdoor Games",
    category: "physical",
    remarks: "Good balance, coordination, and group participation.",
  },
  {
    title: "Handwashing & Hygiene Workshop",
    category: "health",
    remarks: "Practiced proper handwashing before meals.",
  },
  {
    title: "Clay Modelling & Colouring",
    category: "creative",
    remarks: "Showed enthusiasm and creativity in group art.",
  },
  {
    title: "Healthy Meal & Fruit Recognition",
    category: "nutrition",
    remarks: "Identified seasonal fruits and vegetables.",
  },
];

const academicSubjects = [
  { subject: "Language & Rhymes", maxScore: 25 },
  { subject: "Number Readiness", maxScore: 25 },
  { subject: "Motor & Social Skills", maxScore: 25 },
];

const today = new Date();
today.setHours(0, 0, 0, 0);

const pick = (list, index) => list[index % list.length];

async function seed() {
  if (!process.env.SUPABASE_DB_URL) {
    throw new Error("SUPABASE_DB_URL is not configured.");
  }

  await connectDatabase();

  let adminUser = await User.findOne({ role: "admin", email: "administration" });
  if (!adminUser) {
    adminUser = await User.create({
      name: "Administration",
      email: "administration",
      role: "admin",
      passwordHash: await bcrypt.hash("123", 12),
    });
  }

  const existingCenters = await Center.find({
    centerId: { $in: sampleSchools.map((s) => s.centerId) },
  });

  if (existingCenters.length === sampleSchools.length) {
    const childCounts = await Promise.all(
      existingCenters.map((c) => Child.countDocuments({ center: c._id, active: true })),
    );
    const minStudents = Math.min(...childCounts);
    if (minStudents >= STUDENTS_PER_SCHOOL) {
      console.log(
        `Sample dataset already present (${existingCenters.length} schools, min ${minStudents} active students per school). Skipping duplicate seed.`,
      );
      return;
    }
  }

  // Clear incomplete/legacy seed collections before inserting a consistent dataset
  await Promise.all([
    Center.deleteMany({ centerId: { $in: sampleSchools.map((s) => s.centerId) } }),
    User.deleteMany({ email: /@anganwadi\.(demo|local)$/i }),
  ]);

  const centers = await Center.insertMany(
    sampleSchools.map((school) => ({
      ...school,
      status: "active",
    })),
  );

  const centerIds = centers.map((c) => c._id);
  const staffPasswordHash = await bcrypt.hash("SamplePass123!", 10);

  const workerDocs = [];
  const supervisorDocs = [];

  for (let schoolIndex = 0; schoolIndex < centers.length; schoolIndex++) {
    const center = centers[schoolIndex];

    for (let w = 1; w <= 3; w++) {
      workerDocs.push({
        name: `${pick(guardianFirstNames, schoolIndex * 3 + w)} ${pick(lastNames, schoolIndex + w)}`,
        email: `sample.worker.${schoolIndex + 1}.${w}@anganwadi.demo`,
        role: "worker",
        centers: [center._id],
        passwordHash: staffPasswordHash,
      });
    }

    for (let s = 1; s <= 2; s++) {
      supervisorDocs.push({
        name: `Supervisor ${pick(guardianFirstNames, schoolIndex * 2 + s + 5)} ${pick(lastNames, schoolIndex + s + 3)}`,
        email: `sample.supervisor.${schoolIndex + 1}.${s}@anganwadi.demo`,
        role: "supervisor",
        centers: [center._id],
        passwordHash: staffPasswordHash,
      });
    }
  }

  const createdWorkers = await User.insertMany(workerDocs);
  const createdSupervisors = await User.insertMany(supervisorDocs);

  for (const center of centers) {
    const schoolWorkers = createdWorkers.filter(
      (w) => String(w.centers[0]) === String(center._id),
    );
    const schoolSupervisors = createdSupervisors.filter(
      (s) => String(s.centers[0]) === String(center._id),
    );
    center.worker = schoolWorkers[0]?._id;
    center.supervisors = schoolSupervisors.map((s) => s._id);
    await center.save();
  }

  const childDocs = [];

  centers.forEach((center, schoolIndex) => {
    const schoolMeta = sampleSchools[schoolIndex];
    for (let i = 0; i < STUDENTS_PER_SCHOOL; i++) {
      const isFemale = i % 2 === 0;
      const firstName = isFemale
        ? pick(girlFirstNames, schoolIndex * 7 + i)
        : pick(boyFirstNames, schoolIndex * 5 + i);
      const lastName = pick(lastNames, schoolIndex * 3 + i);

      // Spread ages evenly across 0-3 yrs (40%) and 3-6 yrs (60%)
      const isZeroToThree = i % 5 < 2;
      const ageDays = isZeroToThree
        ? 180 + ((i * 29 + schoolIndex * 31) % 880)
        : 1120 + ((i * 37 + schoolIndex * 43) % 1000);
      const dateOfBirth = new Date(today);
      dateOfBirth.setDate(dateOfBirth.getDate() - ageDays);

      const enrolledDaysAgo = 30 + ((i * 11 + schoolIndex * 13) % 300);
      const enrolledAt = new Date(today);
      enrolledAt.setDate(enrolledAt.getDate() - enrolledDaysAgo);

      childDocs.push({
        name: `${firstName} ${lastName}`,
        rollNo: String(i + 1).padStart(3, "0"),
        dateOfBirth,
        gender: isFemale ? "female" : "male",
        guardianName: `${pick(guardianFirstNames, i + schoolIndex)} ${lastName}`,
        guardianPhone: `98${String(10000000 + schoolIndex * 1000 + i).slice(-8)}`,
        address: `House ${10 + i}, ${schoolMeta.village}, ${schoolMeta.district}`,
        enrolledAt,
        center: center._id,
        active: true,
      });
    }
  });

  const createdChildren = await Child.insertMany(childDocs);

  // Growth records (3 monthly checkups per student = 1,500 records)
  const growthDocs = [];
  createdChildren.forEach((child, index) => {
    const schoolIndex = Math.floor(index / STUDENTS_PER_SCHOOL);
    const workerId =
      createdWorkers[schoolIndex * 3]?._id || adminUser._id;
    const ageYears = Math.max(
      0.5,
      (today - new Date(child.dateOfBirth)) / (365.25 * 86400000),
    );
    const baseHeight = Math.min(120, Math.max(62, 62 + ageYears * 9.5));
    const baseWeight = Math.min(24, Math.max(6.5, 6.2 + ageYears * 2.2));

    for (let m = 2; m >= 0; m--) {
      const checkDate = new Date(
        today.getFullYear(),
        today.getMonth() - m,
        Math.min(28, Math.max(1, today.getDate() - (index % 7))),
      );
      growthDocs.push({
        child: child._id,
        center: child.center,
        date: checkDate,
        heightCm: Number((baseHeight - m * 0.6 + (index % 4) * 0.4).toFixed(1)),
        weightKg: Number((baseWeight - m * 0.2 + (index % 3) * 0.15).toFixed(1)),
        observations:
          m === 0
            ? "Healthy growth progression on track."
            : "Routine monthly nutrition & growth checkup.",
        recordedBy: workerId,
      });
    }
  });
  await Growth.insertMany(growthDocs);

  // Student participation & academic assessment records for every student
  const participationDocs = [];
  const academicResultDocs = [];
  const currentYear = today.getFullYear();

  createdChildren.forEach((child, index) => {
    const schoolIndex = Math.floor(index / STUDENTS_PER_SCHOOL);
    const workerId =
      createdWorkers[schoolIndex * 3]?._id || adminUser._id;

    for (let p = 0; p < 2; p++) {
      const template = pick(participationTemplates, index + p);
      const actDate = new Date(today);
      actDate.setDate(actDate.getDate() - (p * 10 + (index % 7) + 1));
      participationDocs.push({
        child: child._id,
        center: child.center,
        date: actDate,
        title: template.title,
        category: template.category,
        remarks: template.remarks,
        recordedBy: workerId,
      });
    }

    academicSubjects.forEach((item, subIdx) => {
      const score = 16 + ((index + subIdx * 3) % 9);
      const assessDate = new Date(today);
      assessDate.setDate(assessDate.getDate() - (14 + subIdx * 5));
      academicResultDocs.push({
        child: child._id,
        center: child.center,
        date: assessDate,
        schoolYear: `${currentYear}-${String(currentYear + 1).slice(-2)}`,
        term: "Term 1",
        subject: item.subject,
        score: Math.min(item.maxScore, score),
        maxScore: item.maxScore,
        remarks:
          score >= 21 ? "Excellent progress" : "Consistent classroom progress",
        recordedBy: workerId,
      });
    });
  });

  await StudentParticipation.insertMany(participationDocs);
  await StudentAcademicResult.insertMany(academicResultDocs);

  // Attendance history (last 30 weekdays + today) for all 100 students per school
  const attendanceDocs = [];
  for (let schoolIndex = 0; schoolIndex < centers.length; schoolIndex++) {
    const center = centers[schoolIndex];
    const workerId = createdWorkers[schoolIndex * 3]?._id || adminUser._id;
    const schoolChildren = createdChildren.slice(
      schoolIndex * STUDENTS_PER_SCHOOL,
      (schoolIndex + 1) * STUDENTS_PER_SCHOOL,
    );

    for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
      const date = new Date(today);
      date.setDate(today.getDate() - dayOffset);
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      const presentTarget =
        80 + ((schoolIndex * 3 + dayOffset * 5) % 16); // 80..95 out of 100
      attendanceDocs.push({
        center: center._id,
        date,
        markedBy: workerId,
        records: schoolChildren.map((child, idx) => ({
          child: child._id,
          status:
            (idx + dayOffset + schoolIndex) % 100 < presentTarget
              ? "present"
              : "absent",
        })),
      });
    }
  }
  await Attendance.insertMany(attendanceDocs);

  // Daily meal logs (past 14 days + today)
  const mealDocs = [];
  for (let schoolIndex = 0; schoolIndex < centers.length; schoolIndex++) {
    const center = centers[schoolIndex];
    const workerId = createdWorkers[schoolIndex * 3]?._id || adminUser._id;

    for (let d = 14; d >= 0; d--) {
      const mealDate = new Date(today);
      mealDate.setDate(today.getDate() - d);
      if (mealDate.getDay() === 0) continue;

      const served = 82 + ((schoolIndex * 3 + d) % 14);
      mealDocs.push({
        center: center._id,
        date: mealDate,
        type: "lunch",
        plannedQuantity: STUDENTS_PER_SCHOOL,
        distributedQuantity: served,
        childrenServed: served,
        completed: true,
        remarks: "Hot nutritious midday meal served.",
        recordedBy: workerId,
      });
    }
  }
  await Meal.insertMany(mealDocs);

  // Weekly Meal Menu (if none exists)
  const existingMenu = await MealMenu.findOne();
  if (!existingMenu) {
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    await MealMenu.create({
      validFrom: monday,
      updatedBy: adminUser._id,
      days: [
        {
          day: "Monday",
          breakfast: "Poha with peanuts & milk",
          lunch: "Dal, Rice & Mixed Seasonal Vegetables",
          snacks: "Roasted chana & banana",
        },
        {
          day: "Tuesday",
          breakfast: "Vegetable Dalia & boiled egg / paneer",
          lunch: "Rajma, Roti & Curd",
          snacks: "Sprouts chaat",
        },
        {
          day: "Wednesday",
          breakfast: "Suji Upma with vegetables",
          lunch: "Moong Dal Khichdi with ghee & spinach",
          snacks: "Seasonal fruit bowl",
        },
        {
          day: "Thursday",
          breakfast: "Besan Chilla & sweet milk",
          lunch: "Chole, Rice & Salad",
          snacks: "Peanut chikki & guava",
        },
        {
          day: "Friday",
          breakfast: "Idli & sambar",
          lunch: "Toor Dal, Roti & Aloo Gobhi",
          snacks: "Makhana & dates",
        },
        {
          day: "Saturday",
          breakfast: "Sweet Dalia & boiled chana",
          lunch: "Vegetable Pulao & Kadhi",
          snacks: "Biscuits & apple slices",
        },
        {
          day: "Sunday",
          breakfast: "Take-home nutrition ration pack",
          lunch: "Take-home dry ration support",
          snacks: "Jaggery & roasted groundnuts",
        },
      ],
    });
  }

  // Operations daily check-in for today and yesterday
  const operationDocs = [];
  for (let schoolIndex = 0; schoolIndex < centers.length; schoolIndex++) {
    const center = centers[schoolIndex];
    const workerId = createdWorkers[schoolIndex * 3]?._id || adminUser._id;
    for (let d = 1; d >= 0; d--) {
      const opDate = new Date(today);
      opDate.setDate(today.getDate() - d);
      operationDocs.push({
        center: center._id,
        date: opDate,
        staffPresent: 3,
        foodStock: "adequate",
        suppliesAvailable: true,
        waterAvailable: true,
        electricityAvailable: true,
        infrastructureIssues: "",
        remarks: "All classroom and kitchen supplies available.",
        submittedBy: workerId,
      });
    }
  }
  await Operation.insertMany(operationDocs);

  // Funds, AcademicProgress, Activities, Notices, CalendarEvents
  await addFundHistory(centers);
  await addAcademicHistory(centers);
  await addRecentActivities(centers);

  await Activity.insertMany([
    {
      center: centers[0]._id,
      date: new Date(today.getTime() + 86400000),
      title: "Nutrition & Wellbeing Day",
      description: "Group session on balanced meals and clean handwashing.",
      category: "health",
      participants: 64,
    },
    {
      center: centers[2]._id,
      date: new Date(today.getTime() + 3 * 86400000),
      title: "Storytelling & Phonics Circle",
      description: "Interactive picture-book storytelling for 3–6 age group.",
      category: "educational",
      participants: 58,
    },
    {
      center: centers[4]._id,
      date: new Date(today.getTime() + 5 * 86400000),
      title: "Outdoor Play & Balance Morning",
      description: "Cooperative games and motor-skill play activities.",
      category: "physical",
      participants: 72,
    },
  ]);

  await Notice.insertMany([
    {
      title: "Monthly Growth Checkup Drive",
      message:
        "Please ensure height and weight measurements for all 100 enrolled children are updated before Friday evening.",
      priority: "important",
      audience: "all",
      receipts: centerIds.map((id, idx) => ({
        center: id,
        readAt: idx < 3 ? new Date() : null,
      })),
      scheduledAt: new Date(today.getTime() - 86400000),
      sentBy: adminUser._id,
    },
    {
      title: "Updated Midday Meal Menu Published",
      message:
        "This week's nutritious meal plan is live under Meal Menu. Follow daily portions closely.",
      priority: "normal",
      audience: "all",
      receipts: centerIds.map((id) => ({
        center: id,
        readAt: new Date(),
      })),
      scheduledAt: new Date(today.getTime() - 2 * 86400000),
      sentBy: adminUser._id,
    },
    {
      title: "Immunization & Health Camp Reminder",
      message:
        "District health team visits next week. Notify guardians in advance for vaccination cards.",
      priority: "urgent",
      audience: "all",
      receipts: centerIds.map((id, idx) => ({
        center: id,
        readAt: idx === 0 ? new Date() : null,
      })),
      scheduledAt: new Date(),
      sentBy: adminUser._id,
    },
  ]);

  await CalendarEvent.insertMany([
    {
      title: "District Health & Growth Camp",
      date: new Date(today.getTime() + 2 * 86400000),
      time: "10:00",
      audience: "all",
      centers: [],
      createdBy: adminUser._id,
    },
    {
      title: "Parents & Guardian Meet",
      date: new Date(today.getTime() + 5 * 86400000),
      time: "11:30",
      audience: "all",
      centers: [],
      createdBy: adminUser._id,
    },
    {
      title: "Nutrition Awareness Session",
      date: new Date(today.getTime() + 8 * 86400000),
      time: "09:30",
      audience: "selected",
      centers: [centers[0]._id, centers[1]._id],
      createdBy: adminUser._id,
    },
  ]);

  console.log(
    `Seeded ${centers.length} schools (${STUDENTS_PER_SCHOOL} students each = ${createdChildren.length} total students), ${createdWorkers.length} workers, ${createdSupervisors.length} supervisors, ${growthDocs.length} growth records, ${participationDocs.length} participation records, ${academicResultDocs.length} academic results, ${attendanceDocs.length} attendance logs, ${mealDocs.length} meal logs, plus weekly menu, operations, funds, academic progress, notices, and calendar events.`,
  );
  console.log("Demo admin login: administration / 123");
  console.log("Demo school login: select any school / 123");
  console.log("Sample staff password: SamplePass123!");
}

async function addFundHistory(centers) {
  const now = new Date();
  const pending = [];

  for (let centerIndex = 0; centerIndex < centers.length; centerIndex++) {
    const center = centers[centerIndex];

    for (let monthOffset = 7; monthOffset >= 0; monthOffset--) {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - monthOffset,
        15,
      );

      if (
        !(await Fund.exists({
          center: center._id,
          date: {
            $gte: new Date(date.getFullYear(), date.getMonth(), 1),
            $lt: new Date(date.getFullYear(), date.getMonth() + 1, 1),
          },
        }))
      ) {
        const received = 22000 + centerIndex * 900 + (7 - monthOffset) * 550;

        pending.push({
          center: center._id,
          date,
          received,
          spent: Math.round(
            received * (0.62 + ((centerIndex + monthOffset) % 5) * 0.04),
          ),
          label: "Monthly Anganwadi grant",
        });
      }
    }
  }

  if (pending.length) await Fund.insertMany(pending);
}

async function addAcademicHistory(centers) {
  const current = new Date().getFullYear();

  for (let index = 0; index < centers.length; index++) {
    const center = centers[index];

    const enrolled = await Child.countDocuments({
      center: center._id,
      active: true,
    });

    for (let offset = 3; offset >= 0; offset--) {
      const year = current - offset;
      const progressPercent = Math.min(96, 62 + (3 - offset) * 8 + (index % 5));
      const milestonesMet = Math.round((enrolled * progressPercent) / 100);

      await AcademicProgress.updateOne(
        { center: center._id, year },
        { $set: { enrolled, milestonesMet, progressPercent } },
        { upsert: true },
      );
    }
  }
}

async function addRecentActivities(centers) {
  const monday = new Date(today);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  const examples = [
    [
      "Learning through stories",
      "Children practiced listening and language skills.",
      "educational",
    ],
    [
      "Nutrition and wellbeing circle",
      "Children explored healthy food and handwashing.",
      "health",
    ],
    [
      "Outdoor movement session",
      "Children practiced balance and cooperative play.",
      "physical",
    ],
    [
      "Creative activity hour",
      "Children worked together on a group art activity.",
      "creative",
    ],
  ];

  const pending = [];

  for (let schoolIndex = 0; schoolIndex < centers.length; schoolIndex++) {
    const center = centers[schoolIndex];

    for (let week = 0; week < 4; week++) {
      const date = new Date(monday);
      date.setDate(date.getDate() - week * 7);
      date.setHours(10, 0, 0, 0);
      const [title, description, category] =
        examples[(schoolIndex + week) % examples.length];

      if (!(await Activity.exists({ center: center._id, date, title }))) {
        pending.push({
          center: center._id,
          date,
          title,
          description,
          category,
          participants: 35 + ((schoolIndex * 5 + week * 7) % 25),
          remarks: "Seeded recent school activity",
        });
      }
    }
  }

  if (pending.length) await Activity.insertMany(pending);
}

seed()
  .catch((error) => {
    console.error("Sample data seeding failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
