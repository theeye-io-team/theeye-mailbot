require('dotenv').config()

const config = require('../lib/config').decrypt()
const MailBot = require('../lib/mailbot')

const main = module.exports = async () => {

  const mailBot = new MailBot(config)
  await mailBot.connect()

  console.log(mailBot.connection.serverInfo)

  const messages = await mailBot.searchMessages({seen:false})
  console.log(messages)

  for (let id of messages) {
    const message =  await mailBot.getMessage(id)
    console.log('===============================================')
    console.log(`Message Seq. ID ${id}`)
    console.log('===============================================')
    console.log(`Attachments: ${message.attachments.length}`)
    console.log(`From: ${mailBot.getFrom(message)}`)
    console.log(`Subject: ${mailBot.getSubject(message)}`)
    console.log(`Body:\n\n ${mailBot.getBody(message)}`)
  }

  await mailBot.closeConnection()

  return 'ok'
}


if (require.main === module) {
  main().then(console.log).catch(console.error)
}

