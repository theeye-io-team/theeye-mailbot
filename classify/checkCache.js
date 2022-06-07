require('dotenv').config()
const DEFAULT_CACHE_NAME = process.env.DEFAULT_CACHE_NAME || 'classification'

const IndicatorHandler = require('./indicatorHandler')
const ClassificationCache = require('./cache')
const Helpers = require('../lib/helpers')
const config = require('../lib/config').decrypt()
const FileApi = require('../lib/file')

//FileApi.access_token = process.env.THEEYE_ACCESS_TOKEN

const fs = require('fs')

const main = module.exports = async (rulesFileEvent) => {
  // cambiamos el contenido de los filtros localmente y debemos actualizar la api.
  // si no fue modificado , evitamos hacer el update del file en la api.
  // si modificamos el archivo permanentemente entra en loop
  const checked = []
  let filtersChanged = false
  let cacheChanged = false

  let currentFilters
  try {
    currentFilters = JSON.parse(fs.readFileSync(rulesFileEvent.config.path))
  } catch (err) {
    throw err
  }

  const classificationCache = new ClassificationCache({ config })

  for (let index = 0; index < currentFilters.length; index++) {
    const filter = currentFilters[index]
    // chequeo de cambios. cualquier cambio require actualizar los indicadores
    const fingerprint = classificationCache.createFilterFingerprint(filter)

    // si no tiene hash, se le asigna uno que coincide con el id que figura en la cache
    if (!filter.id) {
      // se le agrega la info necesaria para el seguimiento de las reglas
      filter.id = fingerprint 
      filter.fingerprint = fingerprint
      filter.enabled = true
      filter.last_update = new Date()
      filter.creation_date = new Date()
      filtersChanged = true
      console.log(`filter [${index}] ${filter.id} was upgraded. id/hash added to filter`)
    }

    // esta en cache?
    const inCacheFilter = classificationCache.getHashData(filter.id)
    if (!inCacheFilter) {
      // es una regla nueva
      console.log(`filter [${index}] ${filter.id} is not present in cache.`)
      classificationCache.initHashData(filter.id, filter)
      // no se hace mas nada. al correr el clasificador la regla se agrega
    } else {
      if (filter.fingerprint !== fingerprint) {
        console.log(`filter [${index}] ${filter.id} fingerprint changed.`)
        filter.last_update = new Date()
        filter.fingerprint = fingerprint
        filtersChanged = true

        classificationCache.updateFilterData(filter.id, filter)
      }
    }

    checked.push(filter.id)
  }

  // check deleted rules
  for (let hash in classificationCache.data) {
    if (hash !== 'runtimeDate') {
      if (checked.indexOf(hash) === -1) {
        console.log(`deleted rule ${hash}`)
        classificationCache.deleteHashData(hash)
        cacheChanged = true
      }
    }
  }

  if (filtersChanged === true) {
    console.log('Local changes. File api upgrades required')
    const file = await FileApi.GetById(rulesFileEvent.config.file)
    file.content = JSON.stringify(currentFilters, null, 2)
    await file.upload()
  }

  if (filtersChanged === true || cacheChanged === true) {
    await IndicatorHandler.updateIndicators(classificationCache)
  }

  return {}
}


if (require.main === module) {
  //main(process.argv[2] || testPayload)
  const payload = JSON.parse(process.argv[2])
  main(payload)
    .then(console.log)
    .catch((err) => {
      console.error(`${err}`)
    })
}
