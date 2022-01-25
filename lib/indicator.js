const got = require('got')

const BASE_URL = JSON.parse(process.env.THEEYE_API_URL || "\"https://supervisor.theeye.io\"")

class TheEyeIndicator {
  constructor (title, type, order) {
    this.apiURL = BASE_URL
    this.customerName = JSON.parse(process.env.THEEYE_ORGANIZATION_NAME || 'null')

    this._title = title
    this.type = (type || 'text')
    this.order = (order || 0)
  }

  get url () {
    const titleURLEncoded = encodeURIComponent(this._title)
    const url = `${this.apiURL}/indicator/title/${titleURLEncoded}?access_token=${this.accessToken}`

    if (this.customerName) {
      return `${url}&customer=${this.customerName}`
    }

    return url
  }

  set value (value) {
    this._value = value
  }

  set state (state) {
    this._state = state
  }

  set order (order) {
    this._order = order
  }

  set type (type) {
    this._type = type
  }

  set severity (severity) {
    this._severity = severity
  }

  set tags (tags) {
    this._tags = tags
  }
  
  set acl (acl) {
    this._acl = acl
  }

  get tags () {
    return this._tags
  }

  get value () {
    return this._value
  }

  get state () {
    return this._state
  }

  get order () {
    return this._order
  }

  get type () {
    return this._type
  }

  get severity () {
    return this._severity
  }

  get acl () {
    return this._acl
  }

  async put () {
    const payload = {
      title: this._title,
      state: this.state,
      value: this.value,
      type: this.type,
      order: this.order,
      severity: this.severity,
      acl: this.acl,
      tags: this.tags
    }

    let response

    try {
      response = await got.put(this.url, {
        json: payload,
        responseType: 'json'
      })
    } catch (err) {
      const reqErr = new Error(`${err.response.statusCode}: ${JSON.stringify(err.response.body)}`)
      console.error(reqErr)
    }

    return response
  }

  static Fetch () {
    const url = `${BASE_URL}/indicator?access_token=${TheEyeIndicator.accessToken}`
    return got(url).catch(err => {
      const reqErr = new Error(`${err.response.statusCode}: ${err.response.body}`)
      console.error(reqErr)
      return err.response
    })
  }

  async patch (payload) {
    let response

    try {
      response = await got.patch(this.url, {
        json: payload,
        responseType: 'json'
      })
    } catch (err) {
      const reqErr = new Error(`${err.response.statusCode}: ${JSON.stringify(err.response.body)}`)
      console.error(reqErr)
    }

    return response
    
  }

  async remove () {
    let response
    try {
      response = await got.delete(this.url)
    } catch (err) {
      const reqErr = new Error(`${err.response.statusCode}: ${err.response.body}`)
      console.error(reqErr)
    }

    return response
  }
}

module.exports = TheEyeIndicator
