const prisma = require('../src/config/prisma');

const DEMO_PREFIX = '[Teacher Overview Demo]';
const QUESTION_COUNT = 40;
const DAY = 86_400_000;
const HOUR = 3_600_000;
const at = (now, offset) => new Date(now.getTime() + offset);

const parseArgs = argv => {
  const teacherArg = argv.find(value => value.startsWith('--teacher='));
  return {
    all: argv.includes('--all'),
    teacherEmail: teacherArg?.slice('--teacher='.length).trim().toLowerCase() || null,
  };
};

const assertSafeEnvironment = () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Teacher Overview demo data cannot be seeded in production.');
  const databaseUrl = new URL(process.env.DATABASE_URL);
  if (!['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname)) {
    throw new Error(`Refusing to seed a non-local database host: ${databaseUrl.hostname}`);
  }
};

const demoClassId = (teacherId, suffix) => `teacher-overview-demo-${teacherId}-${suffix}`;
const demoDeliveryId = (teacherId, suffix) => `teacher-overview-demo-${teacherId}-delivery-${suffix}`;

const ensureStudents = async tx => Promise.all([
  ['ava.carter', 'Ava Carter'],
  ['liam.nguyen', 'Liam Nguyen'],
  ['mia.tran', 'Mia Tran'],
  ['noah.wilson', 'Noah Wilson'],
  ['sophia.lee', 'Sophia Lee'],
].map(([handle, name]) => tx.user.upsert({
  where: { email: `${handle}@teacher-overview.demo` },
  update: { name, role: 'STUDENT' },
  create: { email: `${handle}@teacher-overview.demo`, name, role: 'STUDENT' },
})));

const questionData = index => ({
  type: 'MCQ',
  questionText: `Teacher Overview analytics sample question ${index + 1}`,
  choices: { A: 'Choice A', B: 'Choice B', C: 'Choice C', D: 'Choice D' },
  correctAnswer: 'A',
  blocks: [{ type: 'text', content: `Sample SAT prompt ${index + 1}` }],
  explanation: 'Seeded locally to populate the Teacher Overview learning-insights chart.',
  order: index,
  domainCode: 'RW_INFORMATION_AND_IDEAS',
  skillCode: index % 2 === 0 ? 'RW_CENTRAL_IDEAS_AND_DETAILS' : 'RW_COMMAND_OF_EVIDENCE_TEXTUAL',
});

const curriculumWeeks = now => [
  {
    title: 'Reading Foundations', description: 'Build a reliable process for main ideas and evidence questions.', order: 0, status: 'PUBLISHED', publishedAt: at(now, -28 * DAY),
    lessons: { create: [
      { title: 'Central Ideas and Details', summary: 'Identify claims, purpose, and the most relevant supporting details.', order: 0, status: 'PUBLISHED', scheduledAt: at(now, -26 * DAY), durationMinutes: 60, publishedAt: at(now, -28 * DAY), files: { create: [
        { name: 'Central Ideas Strategy Guide', url: 'https://example.com/sat/central-ideas-guide', kind: 'FILE', order: 0, isRequired: true },
        { name: 'Worked Passage Walkthrough', url: 'https://example.com/sat/central-ideas-video', kind: 'VIDEO', order: 1 },
      ] } },
      { title: 'Command of Evidence', summary: 'Connect textual evidence to claims and conclusions.', order: 1, status: 'PUBLISHED', scheduledAt: at(now, -23 * DAY), durationMinutes: 60, publishedAt: at(now, -28 * DAY), files: { create: [
        { name: 'Evidence Selection Checklist', url: 'https://example.com/sat/evidence-checklist', kind: 'FILE', order: 0, isRequired: true },
      ] } },
    ] },
  },
  {
    title: 'Craft and Structure', description: 'Read for vocabulary, purpose, structure, and cross-text relationships.', order: 1, status: 'PUBLISHED', publishedAt: at(now, -21 * DAY),
    lessons: { create: [
      { title: 'Words in Context', order: 0, status: 'PUBLISHED', scheduledAt: at(now, -19 * DAY), durationMinutes: 50, publishedAt: at(now, -21 * DAY), files: { create: [
        { name: 'Context Clues Practice Set', url: 'https://example.com/sat/context-clues', kind: 'FILE', order: 0, isRequired: true },
      ] } },
      { title: 'Text Structure and Purpose', order: 1, status: 'PUBLISHED', scheduledAt: at(now, -16 * DAY), durationMinutes: 55, publishedAt: at(now, -21 * DAY), files: { create: [
        { name: 'Structure Signal Words', url: 'https://example.com/sat/structure-signals', kind: 'LINK', order: 0 },
      ] } },
      { title: 'Cross-Text Connections', order: 2, status: 'PUBLISHED', scheduledAt: at(now, -14 * DAY), durationMinutes: 55, publishedAt: at(now, -21 * DAY), files: { create: [
        { name: 'Paired Text Comparison Template', url: 'https://example.com/sat/paired-text-template', kind: 'FILE', order: 0 },
      ] } },
    ] },
  },
  {
    title: 'Standard English Conventions', description: 'Strengthen sentence boundaries, grammar, and expression of ideas.', order: 2, status: 'PUBLISHED', publishedAt: at(now, -12 * DAY),
    lessons: { create: [
      { title: 'Boundaries', order: 0, status: 'PUBLISHED', scheduledAt: at(now, -10 * DAY), durationMinutes: 60, publishedAt: at(now, -12 * DAY), files: { create: [
        { name: 'Punctuation Decision Tree', url: 'https://example.com/sat/punctuation-tree', kind: 'FILE', order: 0, isRequired: true },
      ] } },
      { title: 'Form, Structure, and Sense', order: 1, status: 'PUBLISHED', scheduledAt: at(now, -7 * DAY), durationMinutes: 60, publishedAt: at(now, -12 * DAY), files: { create: [
        { name: 'Grammar Error Patterns', url: 'https://example.com/sat/grammar-patterns', kind: 'VIDEO', order: 0 },
      ] } },
    ] },
  },
  {
    title: 'Algebra Foundations', description: 'Model and solve linear equations, inequalities, and systems.', order: 3, status: 'PUBLISHED', publishedAt: at(now, -5 * DAY),
    lessons: { create: [
      { title: 'Linear Equations', order: 0, status: 'PUBLISHED', scheduledAt: at(now, 2 * DAY), durationMinutes: 75, publishedAt: at(now, -5 * DAY), files: { create: [
        { name: 'Linear Equations Practice', url: 'https://example.com/sat/linear-equations', kind: 'FILE', order: 0, isRequired: true },
        { name: 'Desmos Linear Models', url: 'https://example.com/sat/desmos-linear-models', kind: 'LINK', order: 1 },
      ] } },
      { title: 'Systems of Equations', order: 1, status: 'PUBLISHED', scheduledAt: at(now, 4 * DAY), durationMinutes: 60, publishedAt: at(now, -5 * DAY), files: { create: [
        { name: 'Systems Strategy Notes', url: 'https://example.com/sat/systems-notes', kind: 'FILE', order: 0 },
      ] } },
    ] },
  },
  {
    title: 'Advanced Math', description: 'Prepare nonlinear equations, functions, and equivalent expressions.', order: 4, status: 'DRAFT',
    lessons: { create: [
      { title: 'Nonlinear Equations', order: 0, status: 'DRAFT', durationMinutes: 70, files: { create: [
        { name: 'Quadratics Preview', url: 'https://example.com/sat/quadratics-preview', kind: 'FILE', order: 0 },
      ] } },
      { title: 'Functions and Transformations', order: 1, status: 'DRAFT', durationMinutes: 70 },
    ] },
  },
  {
    title: 'Course Review', description: 'Consolidate strategies and prepare a final practice plan.', order: 5, status: 'DRAFT',
    lessons: { create: [
      { title: 'Reading and Writing Strategy Review', order: 0, status: 'DRAFT', durationMinutes: 60 },
      { title: 'Math Strategy Review', order: 1, status: 'DRAFT', durationMinutes: 60 },
      { title: 'Final Practice Plan', order: 2, status: 'DRAFT', durationMinutes: 45 },
    ] },
  },
];

const seedTeacher = async (teacher, now) => prisma.$transaction(async tx => {
  const classIds = ['intensive', 'weekend', 'foundation'].map(suffix => demoClassId(teacher.id, suffix));
  await tx.class.deleteMany({ where: { id: { in: classIds }, teacherId: teacher.id } });
  await tx.test.deleteMany({ where: { authorId: teacher.id, title: { startsWith: DEMO_PREFIX } } });

  const students = await ensureStudents(tx);
  const [ava, liam, mia, noah, sophia] = students;
  const connectStudents = students.map(student => ({ id: student.id }));

  const intensive = await tx.class.create({
    data: { id: classIds[0], name: 'SAT Intensive 1500+', color: '#2563EB', teacherId: teacher.id, students: { connect: connectStudents } },
  });
  const weekend = await tx.class.create({
    data: { id: classIds[1], name: 'Weekend SAT Lab', color: '#7C3AED', teacherId: teacher.id, students: { connect: connectStudents.slice(0, 4) } },
  });
  const foundation = await tx.class.create({
    data: { id: classIds[2], name: 'SAT Foundation', color: '#D97706', teacherId: teacher.id, students: { connect: connectStudents.slice(1) } },
  });

  const taxonomy = await tx.questionDomain.findUnique({
    where: { code: 'RW_INFORMATION_AND_IDEAS' },
    select: { code: true, skills: { where: { code: { in: ['RW_CENTRAL_IDEAS_AND_DETAILS', 'RW_COMMAND_OF_EVIDENCE_TEXTUAL'] } }, select: { code: true } } },
  });
  if (!taxonomy || taxonomy.skills.length !== 2) throw new Error('Run the SAT taxonomy migration/seed before seeding Teacher Overview demo data.');

  const testRecord = await tx.test.create({
    data: {
      title: `${DEMO_PREFIX} Reading & Writing Diagnostic`,
      description: 'Local-only seeded assessment for evaluating the Teacher Overview.',
      duration: 32,
      mode: 'EXAM',
      category: 'CLASS',
      subject: 'RW',
      status: 'PUBLISHED',
      scope: 'PERSONAL',
      authorId: teacher.id,
      sections: { create: { name: 'Reading and Writing', order: 1, duration: 32, questions: { create: Array.from({ length: QUESTION_COUNT }, (_, index) => questionData(index)) } } },
    },
    include: { sections: { include: { questions: { orderBy: { order: 'asc' } } } } },
  });
  const questions = testRecord.sections[0].questions;

  const deliveries = [
    { suffix: 'diagnostic', title: 'Reading & Writing Diagnostic', createdAt: at(now, -24 * DAY), dueAt: at(now, -8 * HOUR), endAt: at(now, -20 * DAY), scorePolicy: 'FIRST' },
    { suffix: 'checkpoint', title: 'Evidence Skills Checkpoint', createdAt: at(now, -16 * DAY), dueAt: at(now, -12 * DAY), endAt: at(now, -12 * DAY), scorePolicy: 'BEST' },
    { suffix: 'review', title: 'Weekly Reading Review', createdAt: at(now, -7 * DAY), dueAt: at(now, -4 * DAY), endAt: at(now, -4 * DAY), scorePolicy: 'LATEST' },
  ];

  for (const deliveryData of deliveries) {
    const deliveryId = demoDeliveryId(teacher.id, deliveryData.suffix);
    const assignedStudents = deliveryData.suffix === 'diagnostic' ? [ava, liam, mia, sophia] : [mia];
    await tx.testDelivery.create({
      data: {
        id: deliveryId,
        classId: intensive.id,
        testId: testRecord.id,
        title: deliveryData.title,
        dueAt: deliveryData.dueAt,
        scorePolicy: deliveryData.scorePolicy,
        status: 'PUBLISHED',
        createdAt: deliveryData.createdAt,
        createdById: teacher.id,
        assignees: { create: assignedStudents.map(student => ({ studentId: student.id, assignedAt: deliveryData.createdAt })) },
      },
    });

    const scoreByStudent = deliveryData.suffix === 'diagnostic'
      ? new Map([[ava.id, 32], [mia.id, 36], [sophia.id, 28]])
      : new Map([[mia.id, deliveryData.suffix === 'checkpoint' ? 30 : 24]]);
    await tx.classActivity.create({
      data: {
        id: `teacher-overview-demo-${teacher.id}-activity-${deliveryData.suffix}`,
        type: 'TEST',
        status: 'PUBLISHED',
        classId: intensive.id,
        title: deliveryData.title,
        dueAt: deliveryData.dueAt,
        scorePolicy: deliveryData.scorePolicy,
        createdById: teacher.id,
        createdAt: deliveryData.createdAt,
        audience: 'SELECTED',
        test: { create: { testDeliveryId: deliveryId } },
        assignees: { create: assignedStudents.map(student => {
          const score = scoreByStudent.get(student.id);
          return score === undefined
            ? { studentId: student.id, status: 'ASSIGNED', assignedAt: deliveryData.createdAt }
            : { studentId: student.id, status: 'COMPLETED', assignedAt: deliveryData.createdAt, startedAt: at(deliveryData.endAt, -30 * 60_000), completedAt: deliveryData.endAt, bestScore: Math.round((score / QUESTION_COUNT) * 100), attemptCount: 1 };
        }) },
      },
    });

    for (const [studentId, score] of scoreByStudent) {
      await tx.submission.create({
        data: {
          userId: studentId,
          testId: testRecord.id,
          deliveryId,
          attemptNo: 1,
          score,
          status: 'COMPLETED',
          startedAt: at(deliveryData.endAt, -30 * 60_000),
          endTime: deliveryData.endAt,
          answers: { create: questions.map((question, index) => ({ questionId: question.id, selectedChoice: index < score ? 'A' : 'B', isCorrect: index < score })) },
        },
      });
    }
  }

  const assignment = await tx.assignment.create({
    data: {
      title: `${DEMO_PREFIX} Complete the Algebra Reflection`,
      type: 'assignment',
      content: 'Summarize the strategy you used and identify one step to improve.',
      fileUrls: [],
      links: [],
      deadline: at(now, 30 * HOUR),
      classId: weekend.id,
    },
  });
  await tx.classActivity.create({
    data: {
      id: `teacher-overview-demo-${teacher.id}-activity-homework`,
      type: 'HOMEWORK', status: 'PUBLISHED', classId: weekend.id,
      title: 'Algebra Strategy Reflection', dueAt: at(now, 30 * HOUR), createdById: teacher.id, createdAt: at(now, -2 * DAY),
      homework: { create: { assignmentId: assignment.id } },
      assignees: { create: [
        { studentId: ava.id, status: 'COMPLETED', assignedAt: at(now, -2 * DAY), startedAt: at(now, -DAY), completedAt: at(now, -18 * HOUR), attemptCount: 1 },
        { studentId: sophia.id, status: 'ASSIGNED', assignedAt: at(now, -2 * DAY) },
      ] },
    },
  });

  await tx.classActivity.create({
    data: {
      id: `teacher-overview-demo-${teacher.id}-activity-resource`,
      type: 'RESOURCE', status: 'PUBLISHED', classId: foundation.id,
      title: 'Functions Review Guide', availableAt: at(now, 20 * HOUR), dueAt: at(now, 6 * DAY), createdById: teacher.id, createdAt: at(now, -14 * DAY),
      assignees: { create: [{ studentId: noah.id, status: 'ASSIGNED', assignedAt: at(now, -12 * DAY) }] },
    },
  });

  const weekDefinitions = curriculumWeeks(now);
  for (const week of weekDefinitions) await tx.week.create({ data: { ...week, classId: foundation.id } });

  return { teacher: teacher.email, classes: 3, students: students.length, submissions: 5, curriculumWeeks: weekDefinitions.length };
});

async function main() {
  assertSafeEnvironment();
  const { all, teacherEmail } = parseArgs(process.argv.slice(2));
  if (!all && !teacherEmail) throw new Error('Pass --all or --teacher=<teacher email>.');
  const teachers = await prisma.user.findMany({
    where: all ? { role: 'TEACHER' } : { role: 'TEACHER', email: teacherEmail },
    orderBy: { id: 'asc' },
    select: { id: true, email: true },
  });
  if (!teachers.length) throw new Error('No matching teacher account was found.');
  const now = new Date();
  const results = [];
  for (const teacher of teachers) results.push(await seedTeacher(teacher, now));
  console.log(JSON.stringify({ seededAt: now.toISOString(), results }, null, 2));
}

main()
  .catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
