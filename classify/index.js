require('dotenv').config()

// default values
const IndicatorHandler = require('./indicatorHandler')
const ClassificationCache = require('./cache')
const config = require('../lib/config').decrypt()
const filters = require('../filters')
const ApplyFilters = require('./applyFilters')

if (process.env.IGNORE_MESSAGES_TIMEZONE === 'true') {
  console.log('Global env IGNORE_MESSAGES_TIMEZONE activated')
}
if (process.env.USE_SERVER_RECEIVED_DATE === 'true') {
  console.log('Global env USE_SERVER_RECEIVED_DATE activated')
}

const main = module.exports = async (date) => {

  const classificationCache = new ClassificationCache({ date, config })
  await ApplyFilters(filters, classificationCache)

  await IndicatorHandler.updateIndicators(classificationCache)
  await IndicatorHandler.orderIndicators('summary')

  return 'ok'
}


if (require.main === module) {
  main(process.argv[2]).then(console.log).catch(console.error)
}
