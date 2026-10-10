// Bound external renderer/network operations without leaving a live timer behind.
async function deadline(operation, milliseconds, label) {
  let timer
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error(label)
          error.name = 'OperationTimeout'
          reject(error)
        }, milliseconds)
      }),
    ])
  } finally { clearTimeout(timer) }
}
module.exports = {deadline}
