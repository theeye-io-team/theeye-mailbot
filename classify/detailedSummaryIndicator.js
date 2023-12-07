// error and output handlers must go first.

/**
 * @param {Object}
 * @prop {Mixed} data
 * @prop {Array} components
 * @prop {Object} next
 */
const successOutput = (options = {}) => {
  // https://documentation.theeye.io/core-concepts/scripts/#passing-arguments-in-workflow
  const output = Object.assign({ state: 'success' }, options)
  console.log( JSON.stringify(output) )
  process.exit(0)
}

/**
 * @param {Error} err
 */
const failureOutput = (err) => {
  console.error(err)
  const output = {
    state: "failure",
    data: {
      message: err.message,
      code: err.code,
      data: err.data 
    }
  }
  console.error( JSON.stringify(output) )
  process.exit(1)
}

process.on('unhandledRejection', (reason, p) => {
  console.error(reason, 'Unhandled Rejection at Promise', p)
  failureOutput(reason)
})

process.on('uncaughtException', err => {
  console.error(err, 'Uncaught Exception thrown')
  failureOutput(err)
})


process.once('SIGINT', function (code) {
  console.log('SIGINT received');
  const err = new Error('SIGINT received')
  err.code = code
  failureOutput(err)
})

process.once('SIGTERM', function (code) {
  console.log('SIGTERM received...');
  const err = new Error('SIGTERM received')
  err.code = code
  failureOutput(err)
})

// NodeJs boilerplate
require('dotenv').config()
const { DateTime } = require('luxon')
const Helpers = require('../lib/helpers')
const TheEyeIndicator = require('../lib/indicator')
const config = require('../lib/config').decrypt()
const ClassificationCache = require('./cache')
const IndicatorHandler = require('./indicatorHandler')

const Constants = {}
Constants.COLOR_STATE_CRITICAL = '#ff4d4d'
Constants.COLOR_STATE_HIGH = '#ff8640'
Constants.COLOR_STATE_LOW = '#ffe400'
Constants.COLOR_STATE_NORMAL = '#50d841'
Constants.COLOR_STATE_STANDBY = '#ffffff'
Constants.STATE_FAILURE = 'failure'
Constants.STATE_SUCCESS = 'normal'

const main = module.exports = async (date = null) => {

  if (new Date(date).toISOString() === 'Invalid Date') {
    throw new Error('fecha invalida')
  }

  const settings = {
    title: config.indicator_titles.status_overview,
    header: {
      name: 'Proceso',
      range: 'Rango Estimado',
      cumplido: 'Cumplido',
      estado: 'Estado'
    }
  }

  const classificationCache = new ClassificationCache({ date, config })
  const html = template(classificationCache, settings)

  const acls = Helpers.getAcls(config)

  const indicatorTitle = IndicatorHandler.prepareIndicatorTitle(
    settings.title,
    classificationCache.data.runtimeDate
  )

  const indicator = new TheEyeIndicator(indicatorTitle)
  indicator.accessToken = process.env.ACCESS_TOKEN
  indicator.value = html
  indicator.order = 1
  indicator.state = 'normal'
  indicator.type = 'text'
  //indicator.tags = [ DateTime.fromISO(classificationCache.data.runtimeDate).toFormat('dd-MM-yyyy') ]
  if (acls !== null) {
    indicator.acl = [].concat(
      acls.manager,
      acls.operator,
      acls.administrator
    )
    console.log(indicator.acls)
  }

  await indicator.put()

  return { data: 'ok' }
}

const template = (classificationCache, settings) => {
  
  const runtimeDateTime = DateTime.fromISO(classificationCache.data.runtimeDate)
  const cache = Helpers.orderCache(
    classificationCache,
    config.timezone,
    runtimeDateTime,
    config.startOfDay
  )
  delete cache.data.runtimeDate
  
	let body = ''
  for (let key in cache.data) {
    const rule = cache.data[key]

    let color
    if (rule.data.result.state === Constants.STATE_FAILURE) {
      const severity = rule.data.result.severity.toUpperCase()
      color = Constants[`COLOR_STATE_${severity}`]
    } else if (rule.data.result.state === Constants.STATE_SUCCESS) {
      color = Constants.COLOR_STATE_NORMAL
    } else {
      color = Constants.COLOR_STATE_STANDBY
    }

    if (rule.data.solved) {
      if (rule.data.solved === 'N/A') {
        icon = 'fa fa-calendar-times-o'
      } else {
        icon = 'fa fa-check'
      }
    } else {
      icon = 'fa fa-clock-o'
    }

    const solved = rule.data.solved
    let hours = (solved && solved !== 'N/A') ? solved : '--:--'

    body += `
	    <tr style="background-color:#304269">
	    	<td>${rule.data.indicatorTitle}</td>
	    	<td>${rule.data.start} - ${rule.data.low}</td>
	    	<td>${hours}</td>
	    	<td>
          <i style="color: ${color}" class="${icon}"></i>
        </td>
	    </tr>
    `
  }

  let html = `
	  <table class="table" style="color:#ffffff">
	  	<thead>
	  		<tr style="background-color:#1a2538">
	  			<th>${settings.header.name}</th>
	  			<th>${settings.header.range}</th>
	  			<th>${settings.header.cumplido}</th>
	  			<th>${settings.header.estado}</th>
	  		</tr>
	  	</thead>
	  	<tbody>${body}</tbody>
	  </table>
	`

	return html
}

// invoke main and capture result output
main().then(successOutput).catch(failureOutput)

