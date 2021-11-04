require('dotenv').config()

// default values
const DEFAULT_CACHE_NAME = "classification"

//const tz = 'America/Argentina/Buenos_Aires'

const { DateTime } = require('luxon')

const Helpers = require('../lib/helpers')
const MailBot = require('../lib/mailbot')
const TheEyeIndicator = require('../lib/indicator')
const TheEyeAlert = require('../lib/alert')
const ClassificationCache = require('./cache')
const config = require('../lib/config').decrypt()
const filters = require('../filters')

const main = module.exports = async () => {

  const { timezone } = config
  let generalState, generalSeverity

  const classificationCache = new ClassificationCache({
    cacheId: (config.cacheName || DEFAULT_CACHE_NAME),
    runtimeDate: buildRuntimeDate(config),
  })

  const runtimeDate = DateTime.fromISO( new Date(classificationCache.data.runtimeDate).toISOString() )
  console.log(`runtime date is set to ${runtimeDate}`)

  const mailBot = new MailBot(config)
  await mailBot.connect()
  const currentDate = DateTime.now().setZone(timezone)

  let index = 0, progress = 0

  for (const filter of filters) {
    const filterHash = classificationCache.createHash(JSON.stringify(filter))
    classificationCache.setBaseFilterData(filterHash, filterData(filter))

    if (classificationCache.alreadyProcessed(filterHash) === true) {
      progress++
      console.log('Skip this rule. Already checked.')
      continue
    }

    const thresholds = filter.thresholdTimes

    //
    // @TODO validar. el rango de las reglas de filtrado no pueden contener la hora de inicio del día. rompe la logica
    //
    const startFilterDate = getFormattedThresholdDate(thresholds.start, timezone, runtimeDate)
    const lowFilterDate = getFormattedThresholdDate(thresholds.low, timezone, runtimeDate)
    const highFilterDate = getFormattedThresholdDate(thresholds.high, timezone, runtimeDate)
    const criticalFilterDate = getFormattedThresholdDate(thresholds.critical, timezone, runtimeDate)

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

          const {state, severity} = indicatorState(mailDate, lowFilterDate, highFilterDate, criticalFilterDate)
          
          const filterPayload = {
            solved:mailDate.toFormat('HH:mm'),
            result: {
              state:state,
              severity:severity
            },
            processed:true
          }

          await message.move()
          classificationCache.updateIndicatorData(filterHash, filterPayload)
        } else {
          console.log(`Old message`)
        }
      }
    }

    if (!found) {
      const {state, severity} = indicatorState(currentDate, lowFilterDate, highFilterDate, criticalFilterDate)
      let alert = false

      if(!classificationCache.data[filterHash].alert[severity]) {
        alert = await sendAlert(classificationCache.data[filterHash], state, severity)
      }

      const filterPayload = {
        result: {
          state:state,
          severity:severity
        },
        alert: {
          severity: severity,
          alert: alert
        }
      }

      classificationCache.updateIndicatorData(filterHash, filterPayload)

      if(!generalState && !generalSeverity) {
        generalState = state
        generalSeverity = severity
      }

      if(state === 'failure') {
        generalState = state
      }

      if(transformSeverity(generalSeverity)<transformSeverity(severity)) {
        generalSeverity = severity
      }
    }

    index++
  }

  await handleProgressIndicator(progress*100/filters.length, timezone, generalSeverity, generalState)
  await handleSummaryIndicator(classificationCache, `Resumen ${DateTime.fromJSDate(new Date(classificationCache.data['runtimeDate'])).toFormat('dd-MM-yyyy')}`, false)
  await handleSummaryIndicator(classificationCache, 'Process Detail', true)
  await handleStatusIndicator(classificationCache, 'Estado')

  await mailBot.closeConnection()

  return true
}

/**
 * 
 * @param {Object} filter 
 * @param {String} state 
 * @param {String} severity 
 * @returns {Boolean}
 */

const sendAlert = async (filter, state, severity) => {
  if(state === 'failure') {
    const subject = `Alerta de Retraso ${severity} correo ${filter.data.indicatorTitle}`
    const body = `
      <p>Estimado,</p> 
      <p>El siguiente correo se encuentra demorado con criticidad <b>${severity}</b></p>
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

  if(state === 'failure' && filter.alert) {
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
        indicatorTitle:filter.indicatorTitle,
        indicatorDescription:filter.indicatorDescription,
        from:filter.from,
        subject:filter.subject,
        body:filter.body,
        start:filter.thresholdTimes.start,
        low:filter.thresholdTimes.low,
        high:filter.thresholdTimes.high,
        critical:filter.thresholdTimes.critical,
        solved:'',
        result:''
      },
      processed: false,
      alert:{
        low:false,
        high:false,
        critical:false
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

  if(lowFilterDate) {
    if(date < lowFilterDate) {
      state = 'normal'
      severity = 'low'
    }

    if(date > lowFilterDate) {
      state = 'failure'
      severity = 'low'
    }
  }

  if(highFilterDate) {

    if(!lowFilterDate && date < highFilterDate) {
      state = 'normal'
      severity = 'low'
    }

    if(date > highFilterDate) {
      state = 'failure'
      severity = 'high'
    }
  }

  if(criticalFilterDate) {

    if(!lowFilterDate && !highFilterDate && date < criticalFilterDate) {
      state = 'normal'
      severity = 'low'
    }

    if(date > criticalFilterDate) {
      state = 'failure'
      severity = 'critical'
    }
  }

  return {state, severity}
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
  const trimmedDate = date.toISOString().replace(/\.[0-9]{3}Z$/,'')
  // create a new Date and initialize it using the desired timezone
  const tzDate = DateTime.fromISO(trimmedDate, { zone: timezone })
  return tzDate
}

/**
 * @param {String} time format 'HH:mm'
 * @param {String} tz timezone string
 * @param {DateTime} startingDate luxon object
 */
const getFormattedThresholdDate = (time, tz, startingDate) => {
  if (!time) { return null }

  let date = DateTime.fromISO( startingDate.toISO() ).setZone(tz)
  const hours = time.substring(0, 2)
  const minutes = time.substring(3, 5)

  // Agregar al config  { ..., "startOfDay" : "14:00", ... }
  if (time < config.startOfDay) {
    date = date.plus({ days: 1 })
  }

  return date.set({ hours, minutes, seconds: 0 })
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

const handleProgressIndicator = (progress, timezone, severity, state) => {

  const date = DateTime.now().setZone(timezone).toFormat('HH:mm')

  const indicator = new TheEyeIndicator(config.classify?.progress_title||'Progress')
  indicator.order = 0
  indicator.accessToken = config.api.accessToken
  indicator.value = Math.round(progress)
  indicator.state = state
  indicator.severity = severity
  indicator.type = 'progress'

  return indicator.put()
}

const handleSummaryIndicator = (classificationData, title, onlyFailure) => {
  let firstRowColor = 'black'
  let tableBaseTextColor = 'white'
  let elements = 1

  let value = `
    <table class="table" style="color:${tableBaseTextColor}">
      <thead>
        <tr>
          <th style="background-color:${firstRowColor}">IndicatorTitle</th>
          <th style="background-color:${firstRowColor}">IndicatorDescription</th>
          <th style="background-color:${firstRowColor}">From</th>
          <th style="background-color:${firstRowColor}">Subject</th>
          <th style="background-color:${firstRowColor}">Body</th>
          <th style="background-color:${firstRowColor}">Start</th>
          <th style="background-color:${firstRowColor}">Low</th>
          <th style="background-color:${firstRowColor}">High</th>
          <th style="background-color:${firstRowColor}">Critical</th>
          <th style="background-color:${firstRowColor}">Solved</th>
          <th style="background-color:${firstRowColor}">Result</th>
        </tr>
      </thead>
      <tbody>
    `

  for(const eachFilter of Object.keys(classificationData.data)) {
    let rowColor = '#3c3c3c'

    if(!eachFilter.match(/(runtime)/gi)) {
      const filterData = classificationData.data[eachFilter].data
      let resultStyle = 'white'
      let resultData = 'Waiting'

      if(filterData.result.severity === 'critical' && filterData.result.state === 'failure') {
        resultStyle = 'red'
        if(filterData.solved) {
          resultData = 'Late'
        }
      }

      if(filterData.result.severity === 'high' && filterData.result.state === 'failure') {
        resultStyle = 'orange'
        if(filterData.solved) {
          resultData = 'Late'
        }
      }

      if(filterData.result.severity === 'low' && filterData.result.state === 'failure') {
        resultStyle = 'yellow'
        if(filterData.solved) {
          resultData = 'Late'
        }
      }

      if(filterData.result.state === 'normal') {
        resultStyle = 'green'
        if(filterData.solved) {
          resultData = 'On Time'
        }
      }

      if(elements % 2) {
        rowColor = '#313131'
      }
     
      let filterValue = `
        <tr>
          <td style="background-color:${rowColor}">${filterData.indicatorTitle}</td>
          <td style="background-color:${rowColor}">${filterData.indicatorDescription || ''}</td>
          <td style="background-color:${rowColor}">${filterData.from}</td>
          <td style="background-color:${rowColor}">${filterData.subject}</td>
          <td style="background-color:${rowColor}">${filterData.body}</td>
          <td style="background-color:${rowColor}">${filterData.start}</td>
          <td style="background-color:${rowColor}">${filterData.low}</td>
          <td style="background-color:${rowColor}">${filterData.high}</td>
          <td style="background-color:${rowColor}">${filterData.critical}</td>
          <td style="background-color:${rowColor}">${filterData.solved}</td>
          <td style="background-color:${rowColor};color:${resultStyle}"><b>${resultData}<b></td>
        </tr>
        `
      
      if(onlyFailure && filterData.result.state && filterData.result.state !== 'normal') {
        elements++
        value = value + filterValue
      }

      if(!onlyFailure) {
        elements++
        value = value + filterValue
      }

    }
  }

  value = value + '</tbody> </table>'

  const indicator = new TheEyeIndicator(title)
  if(onlyFailure) {
    indicator.order = 0
  } else {
    indicator.order = 1
  }
  indicator.accessToken = config.api.accessToken
  indicator.value = value
  indicator.state = ''
  indicator.severity = 'low'

  return indicator.put()

}

const handleStatusIndicator = (classificationData, title) => {
  let firstRowColor = 'black'
  let tableBaseTextColor = 'white'
  let elements = 1
  let rowColor = '#3c3c3c'
  let tempData = []
  
  let value = `
    <table class="table" style="color:${tableBaseTextColor}">
      <thead>
        <tr>
          <th style="background-color:${firstRowColor}">Estado</th>
          <th style="background-color:${firstRowColor}">IndicatorTitle</th>
          <th style="background-color:${firstRowColor}">IndicatorDescription</th>
          <th style="background-color:${firstRowColor}">From</th>
          <th style="background-color:${firstRowColor}">Subject</th>
          <th style="background-color:${firstRowColor}">Body</th>
          <th style="background-color:${firstRowColor}">Start</th>
          <th style="background-color:${firstRowColor}">Low</th>
          <th style="background-color:${firstRowColor}">High</th>
          <th style="background-color:${firstRowColor}">Critical</th>
          <th style="background-color:${firstRowColor}">Solved</th>
          <th style="background-color:${firstRowColor}">Result</th>
        </tr>
      </thead>
      <tbody>
    `

  for(const eachFilter of Object.keys(classificationData.data)) {

    if(!eachFilter.match(/(runtime)/gi)) {
      const filterData = classificationData.data[eachFilter].data

      tempData.push({start: filterData.start, low: filterData.low, high: filterData.high, critical: filterData.critical, solved: filterData. solved, index:eachFilter})
      
    }
  }

  const startSort = tempData.sort((elem1,elem2) => {
    const startOfDay = DateTime.fromFormat(config.startOfDay, 'HH:mm')
    let date1 = DateTime.fromFormat(elem1.start, 'HH:mm')
    let date2 = DateTime.fromFormat(elem2.start, 'HH:mm')

    if(date1 < startOfDay) {
      date1 = date1.plus({days:1})
    }

    if(date2 < startOfDay) {
      date2 = date2.plus({days:1})
    }

    if(date1<date2) {
      return -1
    }

    if(date2>date1) {
      return 1
    }

    return 0
  })

  
  const futureFilters = startSort.filter((elem) => DateTime.fromFormat(elem.start, 'HH:mm') > DateTime.now())
  const allPastFilters = startSort.filter((elem)=> DateTime.fromFormat(elem.start, 'HH:mm')<=DateTime.now())
  const pastFilters = allPastFilters.filter((elem) => elem.solved)
  const currentFilters = allPastFilters.filter((elem) => !elem.solved)

  let dataIndexes = {
    pastFilters:[],
    currentFilters:[],
    futureFilters:[]
  }

  for(let i = pastFilters.length-1; i >= 0; i--) {
    const totalLength = pastFilters.length-1
    if(i === totalLength) {
      dataIndexes.pastFilters.push(pastFilters[i].index)
    } else {
      if(pastFilters[i+1].start === pastFilters[i].start) {
        dataIndexes.pastFilters.push(pastFilters[i].index)
      }
    }
  }

  for(let i = 0; i <= futureFilters.length-1; i++) {
    if(i === 0) {
      dataIndexes.futureFilters.push(futureFilters[i].index)
    } else {
      if(futureFilters[i-1].start === futureFilters[i].start) {
        dataIndexes.futureFilters.push(futureFilters[i].index)
      }
    }
  }

  for(const eachFilter of currentFilters) {
    dataIndexes.currentFilters.push(eachFilter.index)
  }

  const addRow = (filterData, status) => {
    let resultStyle = 'white'
      let resultData = 'Waiting'

      if(filterData.result.severity === 'critical' && filterData.result.state === 'failure') {
        resultStyle = 'red'
        if(filterData.solved) {
          resultData = 'Late'
        }
      }

      if(filterData.result.severity === 'high' && filterData.result.state === 'failure') {
        resultStyle = 'orange'
        if(filterData.solved) {
          resultData = 'Late'
        }
      }

      if(filterData.result.severity === 'low' && filterData.result.state === 'failure') {
        resultStyle = 'yellow'
        if(filterData.solved) {
          resultData = 'Late'
        }
      }

      if(filterData.result.state === 'normal') {
        resultStyle = 'green'
        if(filterData.solved) {
          resultData = 'On Time'
        }
      }

    if(elements % 2) {
      rowColor = '#313131'
    }
   
    let filterValue = `
      <tr>
        <td style="background-color:${rowColor}">${status}</td>
        <td style="background-color:${rowColor}">${filterData.indicatorTitle}</td>
        <td style="background-color:${rowColor}">${filterData.indicatorDescription || ''}</td>
        <td style="background-color:${rowColor}">${filterData.from}</td>
        <td style="background-color:${rowColor}">${filterData.subject}</td>
        <td style="background-color:${rowColor}">${filterData.body}</td>
        <td style="background-color:${rowColor}">${filterData.start}</td>
        <td style="background-color:${rowColor}">${filterData.low}</td>
        <td style="background-color:${rowColor}">${filterData.high}</td>
        <td style="background-color:${rowColor}">${filterData.critical}</td>
        <td style="background-color:${rowColor}">${filterData.solved}</td>
        <td style="background-color:${rowColor};color:${resultStyle}"><b>${resultData}<b></td>
      </tr>
      `      
      elements++
      return filterValue
  }

  for (const eachIndex of dataIndexes.pastFilters) {
    value = value + addRow(classificationData.data[eachIndex].data, 'Anterior')
  }

  for (const eachIndex of dataIndexes.currentFilters) {
    value = value + addRow(classificationData.data[eachIndex].data, 'Actual')
  }

  for (const eachIndex of dataIndexes.futureFilters) {
    value = value + addRow(classificationData.data[eachIndex].data, 'Próximo')
  }


  value = value + '</tbody> </table>'

  const indicator = new TheEyeIndicator(title)
  indicator.order = 2
  indicator.accessToken = config.api.accessToken
  indicator.value = value
  indicator.state = ''
  indicator.severity = 'low'

  return indicator.put()
}

const handleIndicator = ({ order, state, date, label, filter, minDate, maxDate }) => {
  const time = date.toFormat('HH:mm')

  const value = `
    <table class="table">
      <tr><th>From</th><td>${filter.from}</td></tr>
      <tr><th>Subject</th><td>${filter.subject}</td></tr>
      <tr><th>Body</th><td>${filter.body}</td></tr>
      <tr><th>Start</th><td>${minDate.toRFC2822()}</td></tr>
      <tr><th>End</th><td>${maxDate.toRFC2822()}</td></tr>
      <tr><th><b>Result</b></th><td><b>${time} - ${label}</b></td></tr>
    </table>
    `

  const indicator = new TheEyeIndicator(filter.indicatorTitle || filter.subject)
  indicator.order = order
  indicator.accessToken = config.api.accessToken
  indicator.value = value
  indicator.state = state

  return indicator.put()
}

if (require.main === module) {
  main().then(console.log).catch(console.error)
}
