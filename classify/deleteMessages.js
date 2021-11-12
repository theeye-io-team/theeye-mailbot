const { DateTime } = require('luxon')
const MailBot = require('../lib/mailbot-folder')
const config = require('../lib/config').decrypt()


const main = module.exports = async () => {
  const mailBot = new MailBot(config)

  const deletionUpToHours = config.deletionPolicies.hours // In hours

  const currentDate = DateTime.now().setZone(config.timezone)
  console.log(`CurrentDate: ${currentDate.toFormat('dd MMMM, yyyy')}`)

  // Filter
  // The order of the filter must be consistent with the order in the config file
  // const searchCriteria = mailBot.buildSearchCriteria([`${filter.from}`,`${filter.subject}`,`${filter.body}`])
  // const messages = await mailBot.searchMessages(searchCriteria)

  // No filter, will get everything
  const messages = await mailBot.searchMessages(['ALL'])

  const totalMessages = messages.length
  let deletedMessages = 0

  for (const message of messages) {
    const mailDate = adjustTimezone(mailBot.getDate(message))
    const hoursSinceReceived = (currentDate - mailDate) / 3600000
    console.log(`MailDate: ${mailDate.toFormat('dd MMMM, yyyy')}`)
    console.log(`Hours since reception: ${hoursSinceReceived}`)

    if (hoursSinceReceived >= deletionUpToHours) {
      mailBot.deleteMessage(message)
      deletedMessages++
    }
  }

  return `Total messages: ${totalMessages}, Deleted Messages: ${deletedMessages}`
}

/**
 * @param {Date} mailDate
 */
const adjustTimezone = (mailDate) => {
  const date = DateTime
    .fromISO(mailDate.toISOString())
    .setZone(config.timezone)
  return date
}

if (require.main === module) {
  main().then(console.log).catch(console.error)
}
