require('dotenv').config()
const fs = require('fs')
const path = require('path')
const MailApi = require('../lib/api')
const MailBot = require('../lib/mailbot')
const Helpers = require('../lib/helpers')
const config = require('../lib/config').decrypt()
const Request = require('../lib/req')
const { DateTime } = require('luxon')

if(!process.env.DOWNLOAD_RULES_PATH) {
  throw new Error('env process.env.CLASSIFICATION_RULEZ_PATH not defined.')
}

const attachmentDownloadRules = require(process.env.DOWNLOAD_RULES_PATH)

const moveMessage = (message, folder) => {
  if(config.moveProcessedMessages) {
    if(folder) {
      console.log(`Moving message to ${folder}`)
      return message.move()
    }
    return console.log(`Target folder not defined via config.`)
  }
  return console.log(`Move messages disabled via config`)
}

const searchBodyAttachments = async (text, bodyParser) => {

  const attachments = []

    if(bodyParser.url_patterns) {
      for(const urlPattern of bodyParser.url_patterns) {
        const foundAttachments = text.match(new RegExp(urlPattern.pattern, urlPattern.flags))

        if(foundAttachments?.length) {
          for(const url of foundAttachments) {
            const options = {
              url,
              method:'GET'
            }
        
            const fileData = await Request(options)
        
            attachments.push({
              filename: fileData.headers['content-disposition'].replace('attachment; filename=', ''),
              content: Buffer.from(fileData.rawBody)
            })
          }
        }
      }
    }

  return attachments
}

const main = module.exports = async () => {

  const mailBot = new MailBot(config)
  const mailApi = new MailApi(config)
  await mailBot.connect()

  for(const rule of attachmentDownloadRules) {
    const messages = await mailBot.searchMessages(rule.search)

    for (const message of messages) {
      try {
      await message.getContent()
  
      console.log('-----------------------------------------------------')
      console.log('procesando nuevo mensaje')
  
      // parse parts inside body
      const mailFrom = message.from
      const mailSubject = message.subject
      const mailDate = message.date

      let attachments = []

      if(rule.attachments) {
        attachments = [...attachments, ...message.searchAttachments(rule.attachments)]
      }

      if(rule.body_parser) {
        attachments = [...attachments, ...await searchBodyAttachments(message.data.text, rule.body_parser)]
      }
      
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
  
            const attachmentPayload = {
              folder: config.folders.INBOX,
              from: mailFrom,
              subject: mailSubject,
              reception_date: mailDate,
              mail_hash: mailHash,
              attachment_filename: attachment.filename,
              attachment_hash: attachmentHash,
              attachment_renamed: attachmentRenamed,
            }

            await mailApi.checkExists(attachmentPayload)
            .then(res => {
              console.log(res.body)
              if(/not found/i.test(res.body)) {
                console.log('could upload')
                return mailApi.upload(attachmentPayload, attachmentData)
              }
            })
          }
  
          await moveMessage(message, config.folders.processed)
      } else { // no tiene adjuntos o son no procesables
        await moveMessage(message, config.folders.notProcessed) 
      } 

    } catch(err) { // falla un adjunto, el mensaje entero se mueve a error
      console.log(err)
      await moveMessage(message, config.folders.error)
    }
    }
  }
  
  console.log('-----------------------------------------------------')
  console.log('cerrando conexión')

  await mailBot.closeConnection()
}

if (require.main === module) {
  main().then(console.log).catch(console.error)
}
