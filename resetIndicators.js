const token = process.env.ACCESS_TOKEN
const apiURL = process.env.THEEYE_API_URL
const customer = process.env.THEEYE_ORGANIZATION_NAME
const got = require('got')

const config = require('./lib/config').decrypt()

const TheEyeIndicator = require('./lib/indicator')

const filters = require(process.env.CLASSIFICATION_RULEZ_PATH)

const main = module.exports = async () => {
  for (const filter of filters) {
    const indicator = new TheEyeIndicator(filter.indicatorTitle || filter.subject)
    indicator.accessToken = config.theeyeAccessToken
    await indicator.remove()
  }
}

if (require.main === module) {
  main().then(console.log).catch(console.error)
}
