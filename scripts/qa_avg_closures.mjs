import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium, request } = require('playwright')

const baseUrl = process.env.QA_BASE_URL
const apiUrl = process.env.QA_API_URL
const password = process.env.QA_PASSWORD
const existingSimulationId = process.env.QA_ATTEMPT_ID
const evidenceDir = process.env.QA_EVIDENCE_DIR
if (![baseUrl, apiUrl, password, existingSimulationId, evidenceDir].every(Boolean)) {
  throw new Error('QA_BASE_URL, QA_API_URL, QA_PASSWORD, QA_ATTEMPT_ID and QA_EVIDENCE_DIR are required')
}

await fs.mkdir(evidenceDir, { recursive: true })
const api = await request.newContext({ baseURL: apiUrl })

async function tokenFor(identifier) {
  const response = await api.post('/api/v1/auth/login', {
    data: { identifier, password },
  })
  if (!response.ok()) throw new Error(`login failed for ${identifier}: ${response.status()}`)
  return (await response.json()).access_token
}

const studentToken = await tokenFor('student@example.test')
const authHeaders = { Authorization: `Bearer ${studentToken}` }
const chatResponse = await api.post('/api/v1/attempts', {
  headers: authHeaders,
  data: {
    unit_id: 'chapter-3-section-1',
    difficulty: 'standard',
    experience_mode: 'chat',
  },
})
if (!chatResponse.ok()) throw new Error(`chat creation failed: ${await chatResponse.text()}`)
const chatAttemptId = (await chatResponse.json()).id

const simulationResponse = await api.post('/api/v1/attempts', {
  headers: { ...authHeaders, 'Idempotency-Key': `teacher-replay-${Date.now()}` },
  data: {
    unit_id: 'chapter-3-section-1',
    difficulty: 'standard',
    experience_mode: 'simulation',
  },
})
if (!simulationResponse.ok()) {
  throw new Error(`simulation creation failed: ${await simulationResponse.text()}`)
}
const teacherSimulationId = (await simulationResponse.json()).id
const simulationMessage = await api.post(
  `/api/v1/attempts/${teacherSimulationId}/messages`,
  {
    headers: authHeaders,
    data: {
      client_message_id: `teacher-replay-message-${Date.now()}`,
      content: 'Market evidence supports USD 278; we can increase the order to 1,200 units for a reciprocal adjustment.',
    },
  },
)
if (!simulationMessage.ok()) {
  throw new Error(`simulation message failed: ${await simulationMessage.text()}`)
}
const simulationSubmit = await api.post(
  `/api/v1/attempts/${teacherSimulationId}/submit`,
  {
    headers: { ...authHeaders, 'Idempotency-Key': `teacher-replay-submit-${Date.now()}` },
  },
)
if (!simulationSubmit.ok()) {
  throw new Error(`simulation submit failed: ${await simulationSubmit.text()}`)
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await context.newPage()

async function browserLogin(identifier) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await page.getByLabel('邮箱或学号').fill(identifier)
  await page.getByLabel('密码').fill(password)
  await Promise.all([
    page.waitForURL(identifier.startsWith('teacher') ? /\/teacher(?:\?|$)/ : /\/student(?:\?|$)/),
    page.getByRole('button', { name: '登录' }).click(),
  ])
}

await browserLogin('student@example.test')
await page.goto(`${baseUrl}/student/attempts/${existingSimulationId}/evaluation`, {
  waitUntil: 'networkidle',
})
await page.getByRole('heading', { name: /\/100$/ }).waitFor()
await page.screenshot({
  path: path.join(evidenceDir, '11-simulation-evaluation.png'),
  fullPage: true,
})

await page.goto(`${baseUrl}/student/attempts/${chatAttemptId}`, { waitUntil: 'networkidle' })
const chatReply = page.getByLabel('谈判回复')
await chatReply.fill(
  'Comparable market offers are near USD 278. Could you offer USD 283 if we confirm 1,200 units this week?',
)
await page.getByRole('button', { name: '发送消息' }).click()
await page.waitForFunction(
  () =>
    document.querySelectorAll('.message.student').length === 1 &&
    document.querySelectorAll('.message.assistant').length >= 2 &&
    !document.body.innerText.includes('正在输入'),
)
await page.screenshot({
  path: path.join(evidenceDir, '12-legacy-chat-regression.png'),
  fullPage: false,
})
await page.getByRole('button', { name: '正式提交' }).click()
await page.getByRole('button', { name: '确认提交并评价' }).click()
await page.waitForURL(new RegExp(`/student/attempts/${chatAttemptId}/evaluation$`))
await page.getByRole('heading', { name: /\/100$/ }).waitFor()

await page.getByRole('button', { name: '退出登录' }).click()
await browserLogin('teacher@example.test')
await page.goto(`${baseUrl}/teacher/attempts/${teacherSimulationId}`, { waitUntil: 'networkidle' })
await page.getByText('仿真模式', { exact: true }).waitFor()
await page.getByRole('heading', { name: '态势变化与原话证据' }).waitFor()
await page.screenshot({
  path: path.join(evidenceDir, '13-teacher-simulation-replay.png'),
  fullPage: true,
})

const replayEvidence = await page.locator('.state-history').innerText()
const result = {
  existingSimulationId,
  teacherSimulationId,
  chatAttemptId,
  legacyChatCompleted: true,
  teacherReplayHasMode: await page.getByText('仿真模式', { exact: true }).isVisible(),
  teacherReplayHasQuote: replayEvidence.includes('Market evidence supports USD 278'),
}
await fs.writeFile(
  path.join(evidenceDir, 'closure-results.json'),
  `${JSON.stringify(result, null, 2)}\n`,
)
await browser.close()
await api.dispose()
console.log(JSON.stringify(result))
