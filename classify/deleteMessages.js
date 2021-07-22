const { DateTime } = require('luxon')
const MailBotFolder = require('lib/mailbot-folder')
const MailBot = require('lib/mailbot')
const config = require('lib/config').decrypt()
// const helpers = require('lib/helpers') // For filter use
const tz = 'America/Argentina/Buenos_Aires'
const mbsync = require('lib/mbsync')

const deletionUpToHours = config.deletionPolicies.hours //In hours
const useNodeImap = config.useNodeImap

const main = module.exports = async () => {

  const mailBot = await createMailbotInstance(mailbotToggle)
  await mailBot.connect()

    const currentDate = DateTime.now().setZone(tz)
    console.log(`CurrentDate: ${currentDate.toFormat('dd MMMM, yyyy')}`)
  
  // Filter
  // The order of the filter must be consistent with the order in the config file
  // const searchCriteria = helpers.buildSearchCriteria([`${filter.from}`,`${filter.subject}`,`${filter.body}`], config.searchCriteria)
  // const messages = await mailBot.searchMessages(searchCriteria)

    // No filter, will get everything
    const messages = await mailBot.searchMessages()

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

    await mailBot.disconnect()

    return `Total messages: ${totalMessages}, Deleted Messages: ${deletedMessages}`
}

/**
 * @param {Boolean} useNodeImap
 */
 const createMailbotInstance = (useNodeImap) => {
  if(useNodeImap) {
    return new MailBot(config)
  } 
  return new MailBotFolder(config)
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