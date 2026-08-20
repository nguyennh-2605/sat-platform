const taxonomy = [
  {
    code: 'RW_INFORMATION_AND_IDEAS',
    name: 'Information and Ideas',
    subject: 'RW',
    sortOrder: 1,
    skills: [
      ['RW_CENTRAL_IDEAS_AND_DETAILS', 'Central Ideas and Details'],
      ['RW_COMMAND_OF_EVIDENCE_TEXTUAL', 'Command of Evidence – Textual'],
      ['RW_COMMAND_OF_EVIDENCE_QUANTITATIVE', 'Command of Evidence – Quantitative'],
      ['RW_INFERENCES', 'Inferences'],
    ],
  },
  {
    code: 'RW_CRAFT_AND_STRUCTURE',
    name: 'Craft and Structure',
    subject: 'RW',
    sortOrder: 2,
    skills: [
      ['RW_WORDS_IN_CONTEXT', 'Words in Context'],
      ['RW_TEXT_STRUCTURE_AND_PURPOSE', 'Text Structure and Purpose'],
      ['RW_CROSS_TEXT_CONNECTIONS', 'Cross-Text Connections'],
    ],
  },
  {
    code: 'RW_EXPRESSION_OF_IDEAS',
    name: 'Expression of Ideas',
    subject: 'RW',
    sortOrder: 3,
    skills: [
      ['RW_RHETORICAL_SYNTHESIS', 'Rhetorical Synthesis'],
      ['RW_TRANSITIONS', 'Transitions'],
    ],
  },
  {
    code: 'RW_STANDARD_ENGLISH_CONVENTIONS',
    name: 'Standard English Conventions',
    subject: 'RW',
    sortOrder: 4,
    skills: [
      ['RW_BOUNDARIES', 'Boundaries'],
      ['RW_FORM_STRUCTURE_AND_SENSE', 'Form, Structure, and Sense'],
    ],
  },
  {
    code: 'MATH_ALGEBRA',
    name: 'Algebra',
    subject: 'MATH',
    sortOrder: 1,
    skills: [
      ['MATH_LINEAR_EQUATIONS_ONE_VARIABLE', 'Linear Equations in One Variable'],
      ['MATH_LINEAR_FUNCTIONS', 'Linear Functions'],
      ['MATH_LINEAR_EQUATIONS_TWO_VARIABLES', 'Linear Equations in Two Variables'],
      ['MATH_SYSTEMS_LINEAR_EQUATIONS', 'Systems of Linear Equations'],
      ['MATH_LINEAR_INEQUALITIES', 'Linear Inequalities'],
    ],
  },
  {
    code: 'MATH_ADVANCED_MATH',
    name: 'Advanced Math',
    subject: 'MATH',
    sortOrder: 2,
    skills: [
      ['MATH_EQUIVALENT_EXPRESSIONS', 'Equivalent Expressions'],
      ['MATH_NONLINEAR_EQUATIONS', 'Nonlinear Equations'],
      ['MATH_SYSTEMS_NONLINEAR_EQUATIONS', 'Systems of Equations'],
      ['MATH_NONLINEAR_FUNCTIONS', 'Nonlinear Functions'],
    ],
  },
  {
    code: 'MATH_PROBLEM_SOLVING_AND_DATA_ANALYSIS',
    name: 'Problem-Solving and Data Analysis',
    subject: 'MATH',
    sortOrder: 3,
    skills: [
      ['MATH_RATIOS_RATES_UNITS', 'Ratios, Rates, and Units'],
      ['MATH_PERCENTAGES', 'Percentages'],
      ['MATH_ONE_VARIABLE_DATA', 'One-Variable Data'],
      ['MATH_TWO_VARIABLE_DATA', 'Two-Variable Data'],
      ['MATH_PROBABILITY', 'Probability and Conditional Probability'],
      ['MATH_STATISTICAL_INFERENCE', 'Statistical Inference and Margin of Error'],
      ['MATH_STATISTICAL_CLAIMS', 'Evaluating Statistical Claims'],
    ],
  },
  {
    code: 'MATH_GEOMETRY_AND_TRIGONOMETRY',
    name: 'Geometry and Trigonometry',
    subject: 'MATH',
    sortOrder: 4,
    skills: [
      ['MATH_AREA_AND_VOLUME', 'Area and Volume'],
      ['MATH_LINES_ANGLES_TRIANGLES', 'Lines, Angles, and Triangles'],
      ['MATH_RIGHT_TRIANGLES_AND_TRIGONOMETRY', 'Right Triangles and Trigonometry'],
      ['MATH_CIRCLES', 'Circles'],
    ],
  },
];

const normalize = (value) => String(value || '')
  .trim()
  .toLocaleLowerCase()
  .replace(/[–—]/g, '-')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const domains = taxonomy.map(({ skills, ...domain }) => domain);
const skills = taxonomy.flatMap(domain => domain.skills.map(([code, name], index) => ({
  code,
  name,
  domainCode: domain.code,
  sortOrder: index + 1,
})));

const getTaxonomy = (subject) => taxonomy
  .filter(domain => !subject || domain.subject === subject)
  .map(domain => ({
    ...domain,
    skills: domain.skills.map(([code, name], index) => ({ code, name, sortOrder: index + 1 })),
  }));

const findDomain = (value, subject) => domains.find(domain =>
  domain.code === value || (domain.subject === subject && normalize(domain.name) === normalize(value))
);

const findSkill = (value, domainCode) => skills.find(skill =>
  skill.code === value || (skill.domainCode === domainCode && normalize(skill.name) === normalize(value))
);

const validateClassification = ({ subject, domainCode, skillCode }) => {
  const domain = domains.find(item => item.code === domainCode);
  if (!domain) return { valid: false, error: 'Choose a valid content domain.' };
  if (domain.subject !== subject) return { valid: false, error: 'The content domain does not match the test subject.' };

  const skill = skills.find(item => item.code === skillCode);
  if (!skill) return { valid: false, error: 'Choose a valid skill.' };
  if (skill.domainCode !== domain.code) return { valid: false, error: 'The skill does not belong to the selected content domain.' };

  return { valid: true, domain, skill };
};

module.exports = {
  domains,
  skills,
  getTaxonomy,
  findDomain,
  findSkill,
  validateClassification,
};
