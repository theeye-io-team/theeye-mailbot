const TheEyeFiles = require('../lib/file')
const main = async (args) => {
  const payload = JSON.parse(args[0])
  const file = await fetchTheEyeFile(payload.filename)

  const fileUpdates = {
    filename: file.filename,
    description: `Automatically updated on ${new Date().toISOString()}`,
    contentType: 'application/json',
    content: JSON.stringify(file.content, {}, 2) // reset
  }

  await TheEyeFiles.Upsert(fileUpdates)
}

const fetchTheEyeFile = async (filename) => {
  console.log(`getting file ${filename}`)
  const result = await TheEyeFiles.GetByFilename(filename)

  if (!Array.isArray(result)) {
    throw new Error('file fetch error')
  }
  if (result.length === 0) {
    throw new Error('file not found')
  }
  const file = result[0]
  file.content = await TheEyeFiles.Download(file.id)

  return file
}

main(process.argv.slice(2))
