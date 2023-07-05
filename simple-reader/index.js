
const MailBot = require('../lib/mailbot')
const config = require('../lib/config').decrypt()

const main = module.exports = async (params) => {

  const mailBot = new MailBot(config)
  await mailBot.connect()

  const messages = await mailBot.searchMessages({})

  let result
  if (messages.length > 0) {
    const message = messages[0]
    await message.getContent()

    let body
    if (message.body) {
      body = Buffer.from(message.body).toString('base64')
    }

    let destinatarios
    if (message.data.to) {
      destinatarios = message.data.to.value.map(el => el.address).join(',')
    }

    const data = [
      {
        to: destinatarios,
        subject: message.subject,
        from: message.from,
        body
      }
    ]
    await message.move()

    result = { event_name: 'message', data }
  } else {
    result = { event_name: 'end', data: [ 'no more messages' ] }
  }

  await mailBot.closeConnection()
  return result
}

if (require.main === module) {
  main(process.argv[2]).then(console.log).catch(console.error)
}
