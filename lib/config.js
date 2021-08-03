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
  }
}
