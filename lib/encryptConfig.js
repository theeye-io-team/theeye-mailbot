const { publicEncrypt } = require('crypto')
const path = require('path')
const fs = require('fs')

const publicKey = fs.readFileSync(process.argv[3], 'utf8')
console.log(publicKey)

const toEncrypt = fs.readFileSync(process.argv[2], 'utf8')
const encryptBuffer = Buffer.from(toEncrypt)

const encrypted = publicEncrypt(publicKey, encryptBuffer)

console.log('Data to encrypt:')
console.log(toEncrypt)
console.log('cipherText:')
console.log(encrypted.toString())

fs.writeFileSync('./encryptedConfig', encrypted)
