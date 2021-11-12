const crypto = require('crypto')
const path = require('path')
const fs = require('fs')

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
        passphrase: process.env.PRIVATE_KEY_PASSPHRASE,
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
