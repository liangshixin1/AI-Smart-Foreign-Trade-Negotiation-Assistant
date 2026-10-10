const status = document.querySelector('#status')
const buttons = [...document.querySelectorAll('button')]
const input = () => ({key:document.querySelector('#key').value, model:document.querySelector('#model').value})
async function run(action) {
  buttons.forEach(b => { b.disabled = true })
  status.textContent = '正在处理…'
  try { const result = await action(); status.textContent = result.message }
  catch { status.textContent = '操作未完成，请重试。Key 未显示在错误信息中。' }
  finally { buttons.forEach(b => { b.disabled = false }) }
}
window.aiSettings.info().then(info => {
  document.querySelector('#current').textContent = info.configured ? '已保存 Key。如需更换，请重新填写。' : '尚未配置 Key，当前为样例模式。'
  if (info.model) document.querySelector('#model').value = info.model
})
document.querySelector('#test').onclick = () => run(() => window.aiSettings.test(input()))
document.querySelector('#form').onsubmit = event => { event.preventDefault(); run(() => window.aiSettings.save(input())) }
document.querySelector('#remove').onclick = () => {
  if (confirm('删除本机保存的 Key 并重启？学习记录将保留。')) run(() => window.aiSettings.remove())
}
