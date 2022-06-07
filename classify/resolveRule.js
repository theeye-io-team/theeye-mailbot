require('dotenv').config()
const config = require('../lib/config').decrypt()
const Helpers = require('../lib/helpers')
const IndicatorHandler = require('./indicatorHandler')
const { DateTime } = require('luxon')
const ClassificationCache = require('./cache')

const main = module.exports = async (hash, date) => {

  let jobUser = null
  try {
    jobUser = JSON.parse(process.env.THEEYE_JOB_USER)
  } catch (err) {
  }

  const classificationCache = new ClassificationCache({ date, config })
  
  const hashData = classificationCache.getHashData(hash)
  const resolveDate = DateTime.now().setZone(config.timezone)
  
  const lowFilterDate = Helpers.getFormattedThresholdDate(hashData.data.low, config.timezone, DateTime.fromISO(classificationCache.data.runtimeDate), config.startOfDay)
  const highFilterDate = Helpers.getFormattedThresholdDate(hashData.data.high, config.timezone, DateTime.fromISO(classificationCache.data.runtimeDate), config.startOfDay)
  const criticalFilterDate = Helpers.getFormattedThresholdDate(hashData.data.critical, config.timezone, DateTime.fromISO(classificationCache.data.runtimeDate), config.startOfDay)

  const { state, severity } = Helpers.indicatorState(resolveDate, lowFilterDate, highFilterDate, criticalFilterDate)

  hashData.processed = true
  hashData.data.solved = resolveDate.toFormat('HH:mm')
  hashData.data.result.state = state
  hashData.data.result.severity = severity
  hashData.data.manuallyResolved = true
  hashData.data.manuallyResolvedUser = (jobUser?.username || null)

  classificationCache.replaceHashData(hash, hashData)

  await IndicatorHandler.updateIndicators(classificationCache)
  await IndicatorHandler.orderIndicators('summary')
  return true
}

if (require.main === module) {
  main(process.argv[2], process.argv[3]).then(console.log).catch(console.error)
}
