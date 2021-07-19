const { DateTime } = require('luxon')
const MailBotFolder = require('lib/mailbot-folder')
const MailBot = require('lib/mailbot')
// const config = require('config/config.json')
const config = require('lib/config').decrypt()
const tz = 'America/Argentina/Buenos_Aires'
const mbsync = require('lib/mbsync')

const deletionUpToHours = config.deletionPolicies.hours //In hours
const mailbotToggle = config.mbsync

const main = module.exports = async () => {

  const mailBot = await createMailbotInstance(mailbotToggle)

  const searchCriteria = ['ALL']

    const currentDate = DateTime.now().setZone(tz)
    console.log(`CurrentDate: ${currentDate.toFormat('dd MMMM, yyyy')}`)
    const messages = await mailBot.searchMessages(searchCriteria)

    const totalMessages = messages.length
    let deletedMessages = 0

    for(const message of messages) {
      const mailDate = adjustTimezone(mailBot.getDate(message))
      const hoursSinceReceived = (currentDate - mailDate)/3600000
      console.log(`MailDate: ${mailDate.toFormat('dd MMMM, yyyy')}`)
      console.log(`Hours since reception: ${hoursSinceReceived}`)
      
      if(hoursSinceReceived >= deletionUpToHours) {
        mailBot.deleteMessage(message)
        deletedMessages++
      }
    }
    if(mailbotToggle) await mbsync('push')
    return `Total messages: ${totalMessages}, Deleted Messages: ${deletedMessages}`
}

/**
 * @param {Boolean} mailbotToggle
 */
 const createMailbotInstance = async (mailbotToggle) => {
  if(mailbotToggle) {
    await mbsync("pull")
    return new MailBotFolder(config)
  } else {
    const mailBot = new MailBot(config)
    await mailBot.connect()
    return mailBot
  }
}

/**
 * @param {Date} mailDate
 */
const adjustTimezone = (mailDate) => {
  const date = DateTime
    .fromISO(mailDate.toISOString())
    .setZone(tz)
  return date 
}

if (require.main === module) {
  main().then(console.log).catch(console.error)
}