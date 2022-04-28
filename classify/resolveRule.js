const config = require('../lib/config').decrypt()
const Helpers = require('../lib/helpers')
const IndicatorHandler = require('./indicatorHandler')
const { DateTime } = require('luxon')
const ClassificationCache = require('./cache')

const DEFAULT_CACHE_NAME = process.env.DEFAULT_CACHE_NAME || 'classification'

const main = module.exports = async (hash, date) => {
  const cacheName = `${DEFAULT_CACHE_NAME}_${Helpers.buildCacheName(date, config)}`

  console.log({ cacheName })

  const classificationCache = new ClassificationCache({
    cacheId: cacheName,
    runtimeDate: Helpers.buildRuntimeDate(date, config)
  })
  
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
  hashData.data.manuallyResolvedUser = JSON.parse(process.env.THEEYE_JOB_USER)?.username || null
  classificationCache.setHashData(hash, hashData)
  await IndicatorHandler.updateIndicators(classificationCache)
  await IndicatorHandler.orderIndicators('summary')
  return true
}

if (require.main === module) {
  main(process.argv[2], process.argv[3]).then(console.log).catch(console.error)
}
