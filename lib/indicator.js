const got = require('got')

const BASE_URL = JSON.parse(process.env.THEEYE_API_URL || "\"https://supervisor.theeye.io\"")

class TheEyeIndicator {
  constructor (title, type, order) {

    this.apiURL = BASE_URL
    this.customerName = JSON.parse(process.env.THEEYE_ORGANIZATION_NAME || "null")

    this._title = title
    this._type  = (type || 'text')
    this._order = (order || 0)
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

  /**
   * @prop {Luxon<DateTime>} date
   * @prop {String} description
   */
  setValue (date, description, message) {
    const time = date.toFormat('HH:mm')
    this._value = `${description}<br>${time} - ${message}`
    return this
  }

  async put () {
    const payload = {
      title: this._title,
      state: this._state,
      value: this._value,
      type: this._type,
      order: this._order
    }

    let response

    try {
      response = await got.put(this.url, {
        json: payload,
        responseType: 'json'
      })

    } catch (err) {
      console.log(err)
      const reqErr = new Error(`${err.response.statusCode}: ${err.response.body}`)
      console.error(reqErr)
    }

    return response
  }

  static Fetch () {
    const url = `${BASE_URL}/indicator?access_token=${TheEyeIndicator.accessToken}`
    return got(url).catch(err => {
      console.log(err)
      const reqErr = new Error(`${err.response.statusCode}: ${err.response.body}`)
      console.error(reqErr)
      return err.response
    })
  }

  async remove () {
    let response
    try {
      response = await got.delete(this.url)

    } catch (err) {
      console.log(err)
      const reqErr = new Error(`${err.response.statusCode}: ${err.response.body}`)
      console.error(reqErr)
    }

    return response
  }
}

module.exports = TheEyeIndicator
