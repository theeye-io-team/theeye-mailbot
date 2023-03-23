require('dotenv').config()

const { DateTime } = require('luxon')
const Helpers = require('./lib/helpers')
const MailBot = require('./lib/mailbot')
const config = require('./lib/config').decrypt()

const main = module.exports = async (folder, beforeHours, beforeDays = null) => {
  const { timezone } = config

  if (!folder) {
    throw new Error('Missing arg1. Select a Folder')
  }

  beforeHours = parseInt(beforeHours)
  beforeDays = parseInt(beforeDays)

  if (isNaN(beforeHours)) {
    throw new Error('Missing arg2. Select before hours')
  }

  const mailBot = new MailBot(config)
  await mailBot.connect(folder)

  console.log(`connected to folder: ${folder}`)

  let calculatedHours = beforeHours
  if (!isNaN(beforeDays)) { calculatedHours += (beforeDays * 24) }

  let beforeDate = DateTime
    .now()
    .setZone(timezone)
    .minus({ hours: calculatedHours })

  console.log(`searching message before ${beforeDate.toISODate()}`)

  beforeDate = beforeDate.toJSDate()

  const search = { before: beforeDate }

  if (process.env.MAILBOT_DELETE_MODE === 'dry-run') {
    console.log(`dry-run mode on.`)
    const messages = await mailBot.searchMessages(search)
    console.log(`dry-run: detected ${messages.length} messages from ${folder} to delete`)
  } else if (process.env.MAILBOT_DELETE_MODE === 'delete') {
    console.log(`deleting messages`)
    await mailBot.connection.messageDelete(search)
  } else {
    console.log(`process.env.MAILBOT_DELETE_MODE not set. aborted`)
  }

  await mailBot.closeConnection()

}

if (require.main === module) {
  main.apply(main, process.argv.slice(2)).then(console.log).catch(console.error)
}
