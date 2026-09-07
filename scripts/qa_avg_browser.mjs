import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const baseUrl = process.env.QA_BASE_URL
const email = process.env.QA_EMAIL
const password = process.env.QA_PASSWORD
const attemptId = process.env.QA_ATTEMPT_ID
const evidenceDir = process.env.QA_EVIDENCE_DIR

if (![baseUrl, email, password, attemptId, evidenceDir].every(Boolean)) {
  throw new Error('QA_BASE_URL, QA_EMAIL, QA_PASSWORD, QA_ATTEMPT_ID and QA_EVIDENCE_DIR are required')
}

await fs.mkdir(evidenceDir, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext()
const page = await context.newPage()

await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
await page.getByLabel('邮箱或学号').fill(email)
await page.getByLabel('密码').fill(password)
await Promise.all([
  page.waitForURL(/\/student(?:\?|$)/),
  page.getByRole('button', { name: '登录' }).click(),
])
await page.goto(`${baseUrl}/student/attempts/${attemptId}`, { waitUntil: 'networkidle' })
await page.locator('.simulation-workspace').waitFor()

const cases = [
  { width: 360, height: 800, file: '07-mobile-360x800.png' },
  { width: 390, height: 844, file: '08-mobile-390x844.png' },
  { width: 768, height: 1024, file: '09-tablet-768x1024.png' },
  { width: 1280, height: 800, file: '10-desktop-1280x800.png' },
]
const results = []

for (const item of cases) {
  await page.setViewportSize({ width: item.width, height: item.height })
  await page.waitForTimeout(180)
  const metrics = await page.evaluate(() => {
    const composer = document.querySelector('.composer')?.getBoundingClientRect()
    const dialogue = document.querySelector('.dialogue-box')?.getBoundingClientRect()
    const send = document.querySelector('.composer button')?.getBoundingClientRect()
    return {
      innerWidth,
      innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth + 1,
      composerVisible: Boolean(composer && composer.top >= 0 && composer.bottom <= innerHeight + 1),
      sendVisible: Boolean(send && send.top >= 0 && send.bottom <= innerHeight + 1),
      dialogueAboveComposer: Boolean(dialogue && composer && dialogue.bottom <= composer.top + 1),
    }
  })
  results.push({ viewport: `${item.width}x${item.height}`, ...metrics })
  await page.screenshot({ path: path.join(evidenceDir, item.file), fullPage: false })
}

await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(1800)
const textBefore = await page.locator('.dialogue-box .speech').textContent()
const reply = page.getByRole('textbox', { name: '你的回复' })
await reply.fill('中文输入法组合测试')
await reply.dispatchEvent('compositionstart')
await reply.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true })
await reply.dispatchEvent('compositionend', { data: '测试' })
const textAfter = await page.locator('.dialogue-box .speech').textContent()
const imeDraft = await reply.inputValue()

await fs.writeFile(
  path.join(evidenceDir, 'browser-metrics.json'),
  `${JSON.stringify({ viewports: results, ime: { draft: imeDraft, dialogueUnchanged: textBefore === textAfter } }, null, 2)}\n`,
)

if (results.some((item) => !item.noHorizontalOverflow || !item.composerVisible || !item.sendVisible)) {
  throw new Error('Responsive viewport invariant failed')
}
if (imeDraft !== '中文输入法组合测试' || textBefore !== textAfter) {
  throw new Error('IME composition invariant failed')
}

await browser.close()
console.log(JSON.stringify({ viewports: results, ime: { draftPreserved: true, dialogueUnchanged: true } }))
