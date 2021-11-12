require('dotenv').config()

const { DateTime } = require('luxon')
const TheEyeIndicator = require('../lib/indicator')
const config = require('../lib/config').decrypt()

// STYLES

const firstRowColor = '#1a2538'
const tableBaseTextColor = '#ffffff'
const innerRowColorDark = '#23324c'
const innerRowColorLight = '#304269'
const resultCritical = '#ff4d4d'
const resultHigh = '#ff8640'
const resultLow = '#ffe400'
const resultNormal = '#50d841'
const resultStandby = '#ffffff'

module.exports = {
  handleProgressIndicator (progress, timezone, severity, state, acl) {
    const indicator = new TheEyeIndicator(config.classify?.progress_title || 'Progress')
    indicator.order = 0
    indicator.accessToken = config.api.accessToken
    indicator.value = Math.round(progress)
    indicator.state = state
    indicator.severity = severity
    indicator.type = 'progress'
    indicator.acl = acl

    return indicator.put()
  },

  handleSummaryIndicator (classificationData, title, onlyFailure, acl) {
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

    for (const eachFilter of Object.keys(classificationData.data)) {
      let rowColor = innerRowColorDark

      if (!eachFilter.match(/(runtime)/gi)) {
        const filterData = classificationData.data[eachFilter].data
        const { resultStyle, resultData } = applyResultStyles(filterData)

        if (elements % 2) {
          rowColor = innerRowColorLight
        }

        const filterValue = `
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

        if (onlyFailure && filterData.result.state && filterData.result.state !== 'normal') {
          elements++
          value = value + filterValue
        }

        if (!onlyFailure) {
          elements++
          value = value + filterValue
        }
      }
    }

    value = value + '</tbody> </table>'

    const indicator = new TheEyeIndicator(title)
    if (onlyFailure) {
      indicator.order = 0
    } else {
      indicator.order = 1
    }
    indicator.accessToken = config.api.accessToken
    indicator.value = value
    indicator.state = ''
    indicator.severity = 'low'
    indicator.acl = acl

    return indicator.put()
  },

  handleStatusIndicator (classificationData, title, acl) {
    let elements = 1
    const tempData = []

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

    for (const eachFilter of Object.keys(classificationData.data)) {
      if (!eachFilter.match(/(runtime)/gi)) {
        const filterData = classificationData.data[eachFilter].data

        tempData.push({ start: filterData.start, low: filterData.low, high: filterData.high, critical: filterData.critical, solved: filterData.solved, index: eachFilter })
      }
    }

    const startSort = tempData.sort((elem1, elem2) => {
      const startOfDay = DateTime.fromFormat(config.startOfDay, 'HH:mm')
      let date1 = DateTime.fromFormat(elem1.start, 'HH:mm')
      let date2 = DateTime.fromFormat(elem2.start, 'HH:mm')

      if (date1 < startOfDay) {
        date1 = date1.plus({ days: 1 })
      }

      if (date2 < startOfDay) {
        date2 = date2.plus({ days: 1 })
      }

      if (date1 < date2) {
        return -1
      }

      if (date2 > date1) {
        return 1
      }

      return 0
    })

    const futureFilters = startSort.filter((elem) => DateTime.fromFormat(elem.start, 'HH:mm') > DateTime.now())
    const allPastFilters = startSort.filter((elem) => DateTime.fromFormat(elem.start, 'HH:mm') <= DateTime.now())
    const pastFilters = allPastFilters.filter((elem) => elem.solved)
    const currentFilters = allPastFilters.filter((elem) => !elem.solved)

    const dataIndexes = {
      pastFilters: [],
      currentFilters: [],
      futureFilters: []
    }

    for (let i = pastFilters.length - 1; i >= 0; i--) {
      const totalLength = pastFilters.length - 1
      if (i === totalLength) {
        dataIndexes.pastFilters.push(pastFilters[i].index)
      } else {
        if (pastFilters[i + 1].start === pastFilters[i].start) {
          dataIndexes.pastFilters.push(pastFilters[i].index)
        }
      }
    }

    for (let i = 0; i <= futureFilters.length - 1; i++) {
      if (i === 0) {
        dataIndexes.futureFilters.push(futureFilters[i].index)
      } else {
        if (futureFilters[i - 1].start === futureFilters[i].start) {
          dataIndexes.futureFilters.push(futureFilters[i].index)
        }
      }
    }

    for (const eachFilter of currentFilters) {
      dataIndexes.currentFilters.push(eachFilter.index)
    }

    const addRow = (filterData, status) => {
      let rowColor = innerRowColorDark
      const { resultStyle, resultData } = applyResultStyles(filterData)

      if (elements % 2) {
        rowColor = innerRowColorLight
      }

      const filterValue = `
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
    indicator.acl = acl

    return indicator.put()
  }

  // handleIndicator ({ order, state, date, label, filter, minDate, maxDate }) {
  //   const time = date.toFormat('HH:mm')

  //   const value = `
  //     <table class="table">
  //       <tr><th>From</th><td>${filter.from}</td></tr>
  //       <tr><th>Subject</th><td>${filter.subject}</td></tr>
  //       <tr><th>Body</th><td>${filter.body}</td></tr>
  //       <tr><th>Start</th><td>${minDate.toRFC2822()}</td></tr>
  //       <tr><th>End</th><td>${maxDate.toRFC2822()}</td></tr>
  //       <tr><th><b>Result</b></th><td><b>${time} - ${label}</b></td></tr>
  //     </table>
  //     `

  //   const indicator = new TheEyeIndicator(filter.indicatorTitle || filter.subject)
  //   indicator.order = order
  //   indicator.accessToken = config.api.accessToken
  //   indicator.value = value
  //   indicator.state = state

  //   return indicator.put()
  // }
}

const applyResultStyles = (filterData) => {
  let resultStyle = resultStandby
  let resultData = 'Waiting'

  if (filterData.result.severity === 'critical' && filterData.result.state === 'failure') {
    resultStyle = resultCritical
    if (filterData.solved) {
      resultData = 'Late'
    }
  }

  if (filterData.result.severity === 'high' && filterData.result.state === 'failure') {
    resultStyle = resultHigh
    if (filterData.solved) {
      resultData = 'Late'
    }
  }

  if (filterData.result.severity === 'low' && filterData.result.state === 'failure') {
    resultStyle = resultLow
    if (filterData.solved) {
      resultData = 'Late'
    }
  }

  if (filterData.result.state === 'normal') {
    resultStyle = resultNormal
    if (filterData.solved) {
      resultData = 'On Time'
    }
  }

  return { resultStyle, resultData }
}
