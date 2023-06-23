const crypto = require('crypto')
const fs = require('fs')

//
// Gmail IMAP - https://support.google.com/mail/answer/7126229?authuser=4&visit_id=638218321023653038-1076653835&hl=en&rd=1#zippy=%2Cstep-check-that-imap-is-turned-on%2Cstep-change-smtp-other-settings-in-your-email-client%2Ci-cant-sign-in-to-my-email-client
//

module.exports = {
  decrypt (configFile) {
    configFile || (configFile = process.env.CONFIG_FILE_PATH)

    if (!configFile) {
      console.error('Config file path required. use env CONFIG_FILE_PATH')
      process.exit()
    }

    const configFileContent = fs.readFileSync(configFile)
    if (process.env.CONFIG_FILE_ENCRYPTED !== 'true') {
      return JSON.parse(configFileContent)
    }

    const privateKey = fs.readFileSync(process.env.PRIVATE_KEY_PATH, 'utf8')
    // decrypt the cyphertext using the private key
    const decryptBuffer = Buffer.from(configFileContent, 'base64')
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey.toString(),
        passphrase: process.env.PRIVATE_KEY_PASSPHRASE
      },
      decryptBuffer
    )

    return JSON.parse(decrypted.toString('utf8'))
  },
  encrypt () {
    const publicKey = fs.readFileSync(process.argv[3], 'utf8')
    console.log(publicKey)

    const toEncrypt = fs.readFileSync(process.argv[2], 'utf8')
    const encryptBuffer = Buffer.from(toEncrypt)

    const encrypted = crypto.publicEncrypt(publicKey, encryptBuffer)

    console.log('Data to encrypt:')
    console.log(toEncrypt)
    console.log('cipherText:')
    console.log(encrypted.toString())

    fs.writeFileSync('./encryptedConfig', encrypted)
  }
}
