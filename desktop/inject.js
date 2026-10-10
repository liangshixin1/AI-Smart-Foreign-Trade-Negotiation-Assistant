document.querySelector('#form').addEventListener('submit', async event => {
  event.preventDefault()
  const form = event.target
  const data = Object.fromEntries(new FormData(form))
  data.budget_confirmed = Boolean(data.budget_confirmed)
  try {
    const result = await window.credentialWriter.save(data)
    document.querySelector('#status').textContent = result.message
    if (result.saved) form.reset()
  } catch {
    document.querySelector('#status').textContent = '未保存，请检查输入和目录权限。'
  }
})
