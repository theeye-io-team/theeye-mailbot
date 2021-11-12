const config = require('../lib/config').decrypt()
const ClassificationCache = require('./cache')
const DEFAULT_CACHE_NAME = 'classification'

const main = module.exports = async (runtime) => {
  const classificationCache = new ClassificationCache({
    cacheId: (config.cacheName || DEFAULT_CACHE_NAME),
    runtimeDate: new Date(runtime)
  })

  console.log(classificationCache.data)
}

if (require.main === module) {
  main(process.argv[2]).then(console.log).catch(console.error)
}
