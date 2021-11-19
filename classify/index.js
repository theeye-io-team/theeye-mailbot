require('dotenv').config()

// default values
const DEFAULT_CACHE_NAME = 'classification'

// const tz = 'America/Argentina/Buenos_Aires'

const { DateTime } = require('luxon')

const Helpers = require('../lib/helpers')
const MailBot = require('../lib/mailbot')
const indicatorHandler = require('./indicatorHandler')
const TheEyeAlert = require('../lib/alert')
const ClassificationCache = require('./cache')
const config = require('../lib/config').decrypt()
const filters = require('../filters')

const main = module.exports = async () => {
  const { timezone } = config
  let generalState, generalSeverity

  const classificationCache = new ClassificationCache({
    cacheId: (config.cacheName || DEFAULT_CACHE_NAME),
    runtimeDate: buildRuntimeDate(config)
  })

  const cacheData = classificationCache.data

  const runtimeDate = DateTime.fromISO(new Date(cacheData.runtimeDate).toISOString())
  console.log(`runtime date is set to ${runtimeDate}`)

  const mailBot = new MailBot(config)
  await mailBot.connect()
  const currentDate = DateTime.now().setZone(timezone)

  let progress = 0

  for (const filter of filters) {
    const filterHash = classificationCache.createHash(JSON.stringify(filter))

    if (!cacheData[filterHash]) {
      classificationCache.setHashData(filterHash, filterData(filter))
    }

    if (classificationCache.isAlreadyProcessed(filterHash) === true) {
      progress++
      console.log('Skip this rule. Already checked.')
      continue
    }

    const thresholds = filter.thresholdTimes

    //
    // @TODO validar. el rango de las reglas de filtrado no pueden contener la hora de inicio del día. rompe la logica
    //
    const startFilterDate = Helpers.getFormattedThresholdDate(thresholds.start, timezone, runtimeDate, config.startOfDay)
    const lowFilterDate = Helpers.getFormattedThresholdDate(thresholds.low, timezone, runtimeDate, config.startOfDay)
    const highFilterDate = Helpers.getFormattedThresholdDate(thresholds.high, timezone, runtimeDate, config.startOfDay)
    const criticalFilterDate = Helpers.getFormattedThresholdDate(thresholds.critical, timezone, runtimeDate, config.startOfDay)

    //
    // ignore rules not inprogress. skip early checks
    //
    if (startFilterDate > currentDate) {
      console.log('Skip this rule. Not started yet')
      continue
    }

    progress++

    const messages = await mailBot.searchMessages(
      Object.assign({}, filter, {
        since: Helpers.timeExpressionToDate(thresholds.start, timezone).toISOString()
      })
    )

    let found = false

    if (messages.length > 0) {
      for (const message of messages) {
        await message.getContent()

        let mailDate
        if (filter.ignoreMessageTimezone === true) {
          mailDate = ignoreOriginalTimezone(message.date, timezone)
        } else {
          mailDate = setTimezone(message.date, timezone)
        }
        console.log(`mail date is ${mailDate}`)

        // ignore old messages
        if (mailDate > runtimeDate) {
          found = true

          const { state, severity } = indicatorState(mailDate, lowFilterDate, highFilterDate, criticalFilterDate)

          cacheData[filterHash].data.solved = mailDate.toFormat('HH:mm')
          cacheData[filterHash].data.result.state = state
          cacheData[filterHash].data.result.severity = severity
          cacheData[filterHash].processed = true

          await message.move()
          classificationCache.setHashData(filterHash, cacheData[filterHash])
        } else {
          console.log('Old message')
        }
      }
    }

    if (!found) {
      const { state, severity } = indicatorState(currentDate, lowFilterDate, highFilterDate, criticalFilterDate)
      let sentAlert = cacheData[filterHash].alert[severity]

      if (!sentAlert) {
        sentAlert = await sendAlert(cacheData[filterHash], state, severity)
        cacheData[filterHash].alert[severity] = sentAlert
      }

      cacheData[filterHash].data.result.state = state
      cacheData[filterHash].data.result.severity = severity

      classificationCache.setHashData(filterHash, cacheData[filterHash])

      if (!generalState && !generalSeverity) {
        generalState = state
        generalSeverity = severity
      }

      if (state === 'failure') {
        generalState = state
      }

      if (transformSeverity(generalSeverity) < transformSeverity(severity)) {
        generalSeverity = severity
      }
    }
  }

  const MOA_ACL = `${config.acls.manager},${config.acls.operator},${config.acls.administrator}`.split(',')

  const indicatorsUpdates = await Promise.all([
    indicatorHandler.handleProgressIndicator(progress * 100 / filters.length, timezone, generalSeverity, generalState, MOA_ACL).catch(err => err),
    indicatorHandler.handleSummaryIndicator(classificationCache, progressDetail = false, onlyWaiting = false, config.acls.administrator).catch(err => err),
    indicatorHandler.handleSummaryIndicator(classificationCache, progressDetail = true, onlyWaiting = false, config.acls.operator).catch(err => err),
    indicatorHandler.handleSummaryIndicator(classificationCache, progressDetail = true, onlyWaiting = true, config.acls.manager).catch(err => err),
    indicatorHandler.handleStatusIndicator(classificationCache, config.acls.administrator).catch(err => err)
  ])

  console.log(indicatorsUpdates)

  await mailBot.closeConnection()

  return 'ok'
}

/**
 *
 * @param {Object} filter
 * @param {String} state
 * @param {String} severity
 * @returns {Boolean}
 */

const sendAlert = async (filter, state, severity) => {
  if (state === 'failure') {
    const subject = `Alerta de Retraso ${severity} correo ${filter.data.indicatorTitle}`
    const body = `
      <p>Estimado,</p> 
      <p>El siguiente correo se encuentra demorado con severidad <b>${severity}</b></p>
      <ul>
        <li><b>indicatorTitle: </b>${filter.data.indicatorTitle}</li>
        <li><b>From: </b>${filter.data.from}</li>
        <li><b>Subject: </b>${filter.data.subject}</li>
        <li><b>Body: </b>${filter.data.body}</li>
        <li><b>Start: </b>${filter.data.start}</li>
        <li><b>Low: </b>${filter.data.low}</li>
        <li><b>High: </b>${filter.data.high}</li>
        <li><b>Critical: </b>${filter.data.critical}</li>
      </ul>
    `
    const recipients = config.acls.manager.concat(config.acls.operator)
    const alert = new TheEyeAlert(config.api.alert.task, config.api.alert.secret, subject, body, recipients)
    await alert.post()
    return true
  }

  if (state === 'failure' && filter.alert) {
    return true
  }

  return false
}

/**
 *
 * @param {String} severity
 * @returns {Number} severity
 */
const transformSeverity = (severity) => {
  switch (severity) {
    case 'low': return 1
    case 'high': return 2
    case 'critical': return 3
  }
}

/**
 *
 * @param {Object} filter
 * @returns {Object} {dataPayload}
 */

const filterData = (filter) => {
  return {
    data: {
      indicatorTitle: filter.indicatorTitle,
      indicatorDescription: filter.indicatorDescription,
      from: filter.from,
      subject: filter.subject,
      body: filter.body,
      start: filter.thresholdTimes.start,
      low: filter.thresholdTimes.low,
      high: filter.thresholdTimes.high,
      critical: filter.thresholdTimes.critical,
      solved: '',
      result: {
        state: '',
        severity: ''
      }
    },
    processed: false,
    alert: {
      low: false,
      high: false,
      critical: false
    }
  }
}

/**
 *
 * @param {DateTime} currentDate
 * @param {DateTime} lowFilterDate
 * @param {DateTime} highFilterDate
 * @param {DateTime} criticalFilterDate
 * @returns {Object} {state, severity}
 */
const indicatorState = (date, lowFilterDate, highFilterDate, criticalFilterDate) => {
  let state, severity

  if (lowFilterDate) {
    if (date < lowFilterDate) {
      state = 'normal'
      severity = 'low'
    }

    if (date > lowFilterDate) {
      state = 'failure'
      severity = 'low'
    }
  }

  if (highFilterDate) {
    if (!lowFilterDate && date < highFilterDate) {
      state = 'normal'
      severity = 'low'
    }

    if (date > highFilterDate) {
      state = 'failure'
      severity = 'high'
    }
  }

  if (criticalFilterDate) {
    if (!lowFilterDate && !highFilterDate && date < criticalFilterDate) {
      state = 'normal'
      severity = 'low'
    }

    if (date > criticalFilterDate) {
      state = 'failure'
      severity = 'critical'
    }
  }

  return { state, severity }
}

/**
 * Change date to the timezone
 *
 * @param {Date} date
 * @param {String} timezone
 * @return {DateTime} luxon
 */
const setTimezone = (date, timezone) => {
  return DateTime
    .fromISO(date.toISOString())
    .setZone(timezone)
}

/**
 * Keep the same date ignoring the original Timezone.
 * This is assuming that the original timezone is wrong
 * and it must be replaced by the real arrival time.
 *
 * @param {Date} date
 * @param {String} timezone
 * @return {DateTime} luxon
 */
const ignoreOriginalTimezone = (date, timezone) => {
  // use toISOString formatter in UTC/Zero timezone and remove the timezone part
  const trimmedDate = date.toISOString().replace(/\.[0-9]{3}Z$/, '')
  // create a new Date and initialize it using the desired timezone
  const tzDate = DateTime.fromISO(trimmedDate, { zone: timezone })
  return tzDate
}

/**
 *
 * @param {Object} config object with mailbot configuration properties
 * @prop {String} startOfDay HH:mm
 * @prop {String} timezone
 *
 * @return {Date} date object
 *
 */
const buildRuntimeDate = ({ startOfDay, timezone }) => {
  const runtimeDate = DateTime.now().setZone(timezone)

  const hours = startOfDay.substring(0, 2)
  const minutes = startOfDay.substring(3, 5)

  const isoString = runtimeDate.set({ hours, minutes, seconds: 0 }).toISO()
  return new Date(isoString)
}

if (require.main === module) {
  main().then(console.log).catch(console.error)
}
