/*
  Runs a real start -> save -> resume -> submit -> retry flow against a deploy.

  Required environment variables:
    DEPLOY_API_URL=https://your-api.example.com
    DEPLOY_AUTH_TOKEN=<token of a dedicated test student>
    DEPLOY_TEST_ID=123
    DEPLOY_ANSWERS_JSON={"1001":"A","1002":"1/2"}

  Optional: DEPLOY_QUERY=assignmentId=... (or classId=...), DEPLOY_EXPECTED_SCORE=2
*/

const assert = require('node:assert/strict');

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const baseUrl = required('DEPLOY_API_URL').replace(/\/$/, '');
const token = required('DEPLOY_AUTH_TOKEN');
const testId = required('DEPLOY_TEST_ID');
const answers = JSON.parse(required('DEPLOY_ANSWERS_JSON'));
const query = process.env.DEPLOY_QUERY ? `?${process.env.DEPLOY_QUERY}` : '';

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.ok, true, `${response.status} ${JSON.stringify(body)}`);
  return body;
};

const main = async () => {
  const started = await request(`/api/test/${testId}${query}`);
  const submissionId = started.session?.submissionId;
  assert.ok(submissionId, 'start response has no submissionId');

  if (started.mode === 'EXAM') {
    const timing = await request(`/api/test/${testId}/begin`, {
      method: 'POST', body: JSON.stringify({ submissionId })
    });
    assert.ok(timing.serverTime && timing.expiresAt, 'exam timing is missing');
    assert.ok(new Date(timing.expiresAt) > new Date(timing.serverTime), 'exam is already expired');
  }

  await request(`/api/test/${testId}/save-progress${query}`, {
    method: 'POST',
    body: JSON.stringify({
      submissionId, answers, timeLeft: 3600, currentQuestionIndex: 0, violationCount: 0
    })
  });

  const resumed = await request(`/api/test/${testId}${query}`);
  assert.equal(resumed.session.submissionId, submissionId, 'resume created another submission');
  assert.deepEqual(resumed.session.savedAnswers, answers, 'saved answers did not round-trip');

  const payload = JSON.stringify({ submissionId, answers, violationCount: 0 });
  const first = await request(`/api/test/${testId}/submit${query}`, { method: 'POST', body: payload });
  const retry = await request(`/api/test/${testId}/submit${query}`, { method: 'POST', body: payload });

  assert.equal(retry.submissionId, first.submissionId, 'retry returned a different submission');
  assert.equal(retry.score, first.score, 'retry changed the score');
  assert.deepEqual(retry.details, first.details, 'retry changed grading details');

  for (const [questionId, answer] of Object.entries(answers)) {
    const detail = first.details.find((item) => String(item.questionId) === questionId);
    assert.ok(detail, `missing grading detail for question ${questionId}`);
    assert.equal(detail.userSelected, String(answer).trim(), `wrong saved answer for question ${questionId}`);
  }

  if (process.env.DEPLOY_EXPECTED_SCORE) {
    assert.equal(first.score, Number(process.env.DEPLOY_EXPECTED_SCORE), 'unexpected deployed score');
  }

  console.log(`Deploy smoke test passed: submission ${submissionId}, score ${first.score}/${first.totalQuestions}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
