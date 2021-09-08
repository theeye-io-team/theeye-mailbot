require('dotenv').config()

const config = require('../lib/config').decrypt()
const MailBot = require('../lib/mailbot')

const main = module.exports = async () => {

  const mailBot = new MailBot(config)
  await mailBot.connect()

  console.log(mailBot.connection.serverInfo)

  const messages = await mailBot.searchMessages({seen:false})

  console.log(`total ${messages.length}`)
  for (let message of messages) {
    await message.getId()

    console.log('===============================================')
    console.log(`Message Seq. ID ${message.seqId}`)
    console.log('===============================================')
    console.log(message)

    await message.getContent()

    console.log(`Attachments: ${message.data.attachments.length}`)
    console.log(`From: ${message.from}`)
    console.log(`Subject: ${message.subject}`)
    console.log(`Body:\n\n ${message.body}`)
  }

  await mailBot.closeConnection()

  return 'ok'
}


if (require.main === module) {
  main().then(console.log).catch(console.error)
}

