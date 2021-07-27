const fs = require('fs')
const path = require('path')
const MailBot = require('lib/mailbot')
const MailApi = require('lib/api')

const helpers = require('lib/helpers')
const config = require('lib/config').decrypt()
const { DateTime } = require('luxon')

const tz = config.timeZone
let mailBot
let movedMessages = 0
let processedMessages = 0
let attachmentsFound = 0
let attachmentsProcessed = 0

const getFilters = async (filterRules) => {

  filterRules || (filterRules = process.env.CLASSIFICATION_RULEZ_PATH)

  if(!filterRules){
    console.error('Filters file path required. use env CLASSIFICATION_RULEZ_PATH')
    process.exit()
  }

  if(config.filters.csvFilters) {
    const filters = await helpers.buildFiltersFromCSV(filterRules, {separator: ';'})
    // console.log(filters)
    return filters
  } else {
    const filters = JSON.parse(fs.readFileSync(filterRules, 'utf-8'))
    console.log(filters)
    return filters
  }
}

const uploadToApi = async (payload, attachmentPath) => {
  const mailApi = new MailApi(config)

          // verifica si el attachment ya fue procesado.
          const checkResponse = await mailApi.checkExists(payload)
          console.log(checkResponse)

          const mailExists = JSON.parse(checkResponse)
          if (/not found/i.test(mailExists) === true) {
            attachmentsProcessed++
            console.log(`uploading attachment ${attachmentPath}`)
            const uploadResponse = await mailApi.upload(payload, attachmentPath)
            console.log(uploadResponse)
          } else {
            console.log('already processed')
          }
}

const processAttachments = async (message) => {
      // parse parts inside body
      const mailFrom = await mailBot.getFrom(message)
      console.log(mailFrom)
      const mailSubject = await mailBot.getSubject(message)
      console.log(mailSubject)
      const mailDate = await mailBot.getDate(message)
      console.log(mailDate)
      // const mailBody = await mailBot.getBody(message)
      // console.log(mailBody)
  
  //FALTA IMPLEMENTAR PARA MBSYNC
  const attachments = await mailBot.searchAttachments(message)
  //

  let attachmentInfo = []

    if (attachments.length > 0) {
      const attachmentsData = await mailBot.downloadAttachments(message, attachments)
      if (attachmentsData.length > 0) {

        const hashMail = helpers.createHash(`${mailFrom}${mailSubject}${mailDate}`)
        const dateFormatted = helpers.dateFormat(mailDate)
        const attachmentsPath = path.join(config.attachments.rootDirectory, dateFormatted, hashMail)

        console.log(`root attachment directory ${attachmentsPath}`)
        if (!fs.existsSync(attachmentsPath)) {
          console.log('creating root attachment directory')
          fs.mkdirSync(attachmentsPath, { recursive: true })
        }

        for (const index in attachmentsData) {
          attachmentsFound++

          const attachmentHash = helpers.createHash(attachmentsData[index].data)
          const fileExt = path.extname(attachmentsData[index].filename)
          const renamedFile = `${config.folders.INBOX}_${dateFormatted}_${hashMail}_${attachmentHash}${fileExt}`
          const attachmentPath = path.join(attachmentsPath, renamedFile)
          const attachmentData = attachmentsData[index].data

          console.log(`saving attachment into ${attachmentPath}`)
          fs.writeFileSync(attachmentPath, attachmentData)

          const payload = {
            folder: config.folders.INBOX,
            from: mailFrom,
            subject: mailSubject,
            reception_date: mailDate,
            mail_hash: hashMail,
            attachment_filename: attachmentsData[index].filename,
            attachment_hash: attachmentHash,
            attachment_renamed: renamedFile
          }
          
          if(config.useApi) {
            await uploadToApi(payload, attachmentPath)
          } 
            attachmentInfo.push(payload)
            attachmentsProcessed++
        }
        fs.writeFileSync(path.join(attachmentsPath, 'attachmentInfo.json'), JSON.stringify(attachmentInfo), 'utf-8')
      }
    }
    return attachmentInfo
  }

const moveProcessedMessage = async (message, attachments) => {
   if (attachments.length === 0 && config.attachments.processAttachments) {
      if (config.folders.notProcessed) {
        await mailBot.moveMessage(message)
      } else {
        console.log('message not processed, notProcessed folder not defined in config')
      }
    } else {
      if (config.folders.processed) {
        await mailBot.moveMessage(message)
      } else {
        console.log('message processed, processed folder not defined in config')
      }
    }
    movedMessages++
}
const processMessages = async (messages) => {
  const currentDate = DateTime.now().setZone(tz)

  for (const message of messages) {
    
    let attachmentInfo = []

    if (config.attachments.processAttachments) {
      console.log('processingAttachments enabled by config')
      attachmentInfo = await processAttachments(message)
    }

    processedMessages++
    
    await moveProcessedMessage(message, attachmentInfo)

}
}

const main = module.exports = async () => {

  mailBot = new MailBot(config)
  await mailBot.connect()

  
  if(config.filters.useFilters) {
    const filters = await getFilters('/home/damian/Work/theeye-projects/github/theeye-mailbot/quinor/files/remitentes.csv')

    for (const filter of filters) {
      // The order of the filter must be consistent with the order in the config file
      // console.log(filter)
      const searchCriteria = helpers.buildSearchCriteria([`${filter.remitente}`], config.filters.searchCriteria)
      const messages = await mailBot.searchMessages(searchCriteria)
  
      if (messages.length > 0) {
        await processMessages(messages)
      }
    }
  } else {
    const messages = await mailBot.searchMessages()

    if (messages.length > 0) {
      await processMessages(messages)
    }
  }
  
  await mailBot.disconnect()

  return { processedMessages, movedMessages, attachmentsFound, attachmentsProcessed }
}


if (require.main === module) {
  main().then(console.log).catch(console.error)
}
