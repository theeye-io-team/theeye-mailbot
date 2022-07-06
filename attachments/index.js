require('dotenv').config()
const downloadAttachments = require('./downloadAttachments')
const apiHandler = require('./apiHandler')

const main = module.exports = async () => apiHandler(await downloadAttachments())

if (require.main === module) {
  main().then(console.log).catch(console.error)
}