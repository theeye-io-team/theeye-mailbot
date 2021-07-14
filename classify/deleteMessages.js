const { DateTime } = require('luxon')

const MailBot = require('../lib/mailbot-folder')
const config = require('../config/config.json')
const tz = 'America/Argentina/Buenos_Aires'

const deletionStamp = config.deletionStamp //In hours

const main = module.exports = async () => {

  const mailBot = new MailBot(config)

    const searchCriteria = [
      ['BODY', ``],
      ['FROM', ``],
      ['SUBJECT', ``]
    ]

    const currentDate = DateTime.now().setZone(tz)
    console.log(`CurrentDate: ${currentDate.toFormat('dd MMMM, yyyy')}`)
    const messages = await mailBot.searchMessages(searchCriteria)

    const totalMessages = messages.length
    let deletedMessages = 0

    for(const message of messages) {
      const mailDate = adjustTimezone(mailBot.getDate(message))
      const delDate = mailDate.plus({ hours: deletionStamp })
      console.log(`MailDate: ${mailDate.toFormat('dd MMMM, yyyy')}`)
      console.log(`DeletionDate: ${delDate.toFormat('dd MMMM, yyyy')}`)
      
      if(currentDate > delDate) {
        mailBot.deleteMessage(message)
        deletedMessages++
      }
    }

    return `Total messages: ${totalMessages}, Deleted Messages: ${deletedMessages}`
}

const adjustTimezone = (mailDate) => {
  const date = DateTime
    .fromISO(mailDate.toISOString())
    .setZone(tz)
  return date 
}

if (require.main === module) {
  main().then(console.log).catch(console.error)
}