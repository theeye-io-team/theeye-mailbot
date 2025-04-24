require('dotenv').config()

const EncConfig = require('theeye-bot-sdk/core/config')
const MailBot = require('theeye-bot-sdk/core/mail/client')

const main = module.exports = async () => {
  try {
    const config = EncConfig.decrypt()
    console.log(config)

    const mailBot = new MailBot(config)

    console.log('connecting ..')
    await mailBot.connect()
    console.log('connected!')

    console.log(mailBot.connection.serverInfo)

    console.log('fetching messages ..')
    // Search for messages in the last 7 days
    const days = 7
    const milliseconds = days * 24 * 60 * 60 * 1000
    
    // Create a date range from 7 days ago until now
    const sinceDate = new Date(Date.now() - milliseconds)
    const currentDate = new Date()
    
    // Custom search criteria with proper date range
    const searchCriteria = {
      // Using custom filter instead of "since" to get all emails in date range
      customFilter: `receivedDateTime ge ${sinceDate.toISOString()} and receivedDateTime le ${currentDate.toISOString()}`
    }
    
    const messages = await mailBot.searchMessages(searchCriteria)
    
    // Display the total messages found
    console.log(`Total messages found: ${messages.length}`)
    
    // Display a fixed number of messages (up to 5)
    const messagesToShow = Math.min(5, messages.length)
    console.log(`Showing ${messagesToShow} most recent messages:`)
    
    for (let i = 0; i < messagesToShow; i++) {
      console.log(`\nMessage ${i+1}:`)
      console.log(`Subject: ${messages[i].data.subject}`)
      console.log(`From: ${messages[i].data.from.value[0].address}`)
      console.log(`Received: ${messages[i].data.date}`)
    }

    console.log('closing connection..')
    await mailBot.closeConnection()
    return 'ok'
  } catch (err) {
    console.error(err)
  }
}

main().then(console.log).catch(console.error)
