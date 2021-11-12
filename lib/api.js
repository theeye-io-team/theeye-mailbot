const https = require('https')
const http = require('http')
const fs = require('fs')
const qs = require('qs')
const FormData = require('form-data')

class API {
  constructor (config) {
    this.config = config.api
  }

  /**
   * @param {Object} payload
   * @prop {String} payload.from
   * @prop {String} payload.subject
   * @prop {String} payload.reception_date
   * @prop {String} payload.attachment_filename
   * @prop {String} payload.attachment_hash
   * @prop {String} payload.mail_hash
   * @prop {String} payload.attachment_renamed
   *
   * @return Promise
   */
  checkExists (payload) {
    const query = qs.stringify(payload)

    const options = {
      hostname: this.config.hostname,
      port: this.config.port,
      path: `/api/Mails/check?${query}&access_token=${this.config.accessToken}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      }
    }

    return new Promise((resolve, reject) => {
      const request = (this.config.protocol === 'http' ? http : https).request
      const req = request(options, res => {
        let resString = ''
        res.on('data', d => {
          if (d) { resString += d }
        })
        res.on('end', () => resolve(resString))
      })
      req.on('error', error => reject(error))
      req.end()
    })
  }

  /**
   *
   * @param {Object} payload
   * @prop {String} payload.from
   * @prop {String} payload.subject
   * @prop {String} payload.reception_date
   * @prop {String} payload.attachment_filename
   * @prop {String} payload.attachment_hash
   * @prop {String} payload.mail_hash
   * @prop {String} payload.attachment_renamed
   * @param {string} filePath path to attachment
   *
   * @return Promise
   *
   */
  upload (payload, filePath) {
    const formData = new FormData()
    formData.append('payload', JSON.stringify(payload))
    formData.append('file', fs.createReadStream(filePath))

    const options = {
      hostname: this.config.hostname,
      port: this.config.port,
      path: `/api/Mails/upload?access_token=${this.config.accessToken}`,
      method: 'POST',
      headers: formData.getHeaders()
    }

    return new Promise((resolve, reject) => {
      const request = (this.config.protocol === 'http' ? http : https).request(options)
      formData.pipe(request)
      request.on('response', res => {
        let resString = ''
        res.on('data', d => {
          if (d) { resString += d }
        })
        res.on('end', () => resolve(resString))
      })
      request.on('error', error => reject(error))
      //request.end()
    })
  }
}

module.exports = API
