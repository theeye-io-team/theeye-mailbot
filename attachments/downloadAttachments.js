require('dotenv').config()
const fs = require('fs')
const path = require('path')
const MailBot = require('../lib/mailbot')
const Helpers = require('../lib/helpers')
const config = require('../lib/config').decrypt()
const { DateTime } = require('luxon')

if(!process.env.DOWNLOAD_RULES_PATH) {
  throw new Error('env process.env.CLASSIFICATION_RULEZ_PATH not defined.')
}

const attachmentDownloadRules = require(process.env.DOWNLOAD_RULES_PATH)

const messageNotProcessed = async (message) => {
  console.log('Moviendo mensaje a NO Procesados')
  if (config.folders.notProcessed) {
    message.move()
  } else {
    console.log('mensaje no procesado. no se mueve. carpeta destino no definida')
  }
}

const messageProcessed = async (message) => {
  console.log('Moviendo mensaje a Procesados')
  if (config.folders.processed) {
    message.move()
  } else {
    console.log('mensaje procesado. no se mueve. carpeta destino no definida')
  }
}

const main = module.exports = async () => {
  const processedAttachments = []

  const mailBot = new MailBot(config)
  await mailBot.connect()

  for(const rule of attachmentDownloadRules) {
    const messages = await mailBot.searchMessages(rule)

    for (const message of messages) {
      await message.getContent()
  
      console.log('-----------------------------------------------------')
      console.log('procesando nuevo mensaje')
  
      // parse parts inside body
      const mailFrom = message.from
      const mailSubject = message.subject
      const mailDate = message.date
  
      const attachments = message.searchAttachments()
  
      if (attachments.length > 0) {
  
          const mailHash = Helpers.createHash(`${mailFrom}${mailSubject}${mailDate}`)
          const dateFormatted = DateTime.fromJSDate(mailDate).toFormat(config.attachments.dateFormat)
  
          for (const attachment of attachments) {
  
            const attachmentData = attachment.content
            const attachmentHash = Helpers.createHash(attachmentData)
            const attachmentExt = path.extname(attachment.filename)
            const attachmentRenamed = `${config.folders.INBOX}_${dateFormatted}_${mailHash}_${attachmentHash}${attachmentExt}`
  
            if(config.attachments.saveToDiskDir) {
              const attachmentsPath = path.join(config.attachments.saveToDiskDir, dateFormatted, mailHash)
  
              if (!fs.existsSync(attachmentsPath)) {
                console.log(`creating attachments download folder ${attachmentsPath}`)
                fs.mkdirSync(attachmentsPath, { recursive: true })
              }
  
              const attachmentPath = path.join(attachmentsPath, attachmentRenamed)
              console.log(`saving attachment into ${attachmentPath}`)
              fs.writeFileSync(attachmentPath, attachmentData)
            }
  
            processedAttachments.push({
              folder: config.folders.INBOX,
              from: mailFrom,
              subject: mailSubject,
              reception_date: mailDate,
              mail_hash: mailHash,
              attachment_filename: attachment.filename,
              attachment_hash: attachmentHash,
              attachment_renamed: attachmentRenamed,
              attachment_data: attachmentData
            })
          }
  
          await messageProcessed(message)
      } else { await messageNotProcessed(message) } // no tiene adjuntos o son no procesables
  
    }
  }
  

  console.log('-----------------------------------------------------')
  console.log('cerrando conexión')

  await mailBot.closeConnection()

  return processedAttachments
}

if (require.main === module) {
  main().then(console.log).catch(console.error)
}
