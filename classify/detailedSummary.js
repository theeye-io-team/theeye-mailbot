require('dotenv').config()
const { DateTime } = require('luxon')
const Helpers = require('../lib/helpers')
const TheEyeIndicator = require('../lib/indicator')
const config = require('../lib/config').decrypt()
const ClassificationCache = require('./cache')

const main = module.exports = async (date = null) => {

  if (new Date(date).toISOString() === 'Invalid Date') {
    throw new Error('fecha invalida')
  }

  const classificationCache = new ClassificationCache({ date, config })

  const runtimeDateTime = DateTime.fromISO(classificationCache.data.runtimeDate)
  const orderedCache = Helpers.orderCache(
    classificationCache,
    config.timezone,
    runtimeDateTime,
    config.startOfDay
  )

  delete orderedCache.runtimeDate

  const settings = {
    title: `Resumen ${runtimeDateTime.toFormat('dd-MM-yyyy')}`,
    header: {
      name: 'Proceso',
      range: 'Rango Estimado',
      cumplido: 'Cumplido',
      estado: 'Estado'
    }
  }

  const html = template(orderedCache, settings)

  const acls = Helpers.getAcls(config)

  const indicator = new TheEyeIndicator(settings.title)
  indicator.accessToken = process.env.ACCESS_TOKEN
  indicator.value = html
  indicator.order = 0
  indicator.state = 'normal'
  indicator.type = 'html'
  if (acls !== null) {
    indicator.acl = [].concat(
      acls.manager,
      acls.operator,
      acls.administrator
    )
  }

  await indicator.put()

  return html
}

const template = (data, settings) => {
	let body = ''
  for (let rule of data) {
    body += `
	    <tr>
	    	<td style="background-color:#304269">${rule.data.indicatorTitle}</td>
	    	<td style="background-color:#304269"></td>
	    	<td style="background-color:#304269">13:17</td>
	    	<td style="background-color:#304269">
          <i style="color: green" class="fa fa-check"></i>
        </td>
	    </tr>
    `
  }

  let html = `
	  <table class="table" style="color:#ffffff">
	  	<thead>
	  		<tr>
	  			<th style="background-color:#1a2538">${settings.header.name}</th>
	  			<th style="background-color:#1a2538">${settings.header.range}</th>
	  			<th style="background-color:#1a2538">${settings.header.cumplido}</th>
	  			<th style="background-color:#1a2538">${settings.header.estado}</th>
	  		</tr>
	  	</thead>
	  	<tbody>${body}</tbody>
	  </table>
	`

	return html
}

if (require.main === module) {
  main(process.argv[2]).then(console.log).catch(console.error)
}
