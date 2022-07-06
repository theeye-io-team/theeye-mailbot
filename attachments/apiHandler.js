require('dotenv').config()
const MailApi = require('../lib/api')
const config = require('../lib/config').decrypt()

const main = module.exports = async (attachments) => {

  const mailApi = new MailApi(config)

  const uploadPromises = []

  for (const attachment of attachments) {

    const {attachment_data, ...attachment_payload} = attachment

    uploadPromises.push(mailApi.checkExists(attachment_payload)
    .then(res => {
      if(/not found/i.test(res.body)) {
        return mailApi.upload(attachment_payload, attachment_data)
      }
    })
    )
  }

  return Promise.allSettled(uploadPromises)
}

if (require.main === module) {
  main().then(console.log).catch(console.error)
}
