

/**

 en la primera que encuentra termina.
 si llega al final continua por el flow de resumir.

 soporta todas las operaciones que soporta chai
 https://www.chaijs.com/api/assert/

**/
/**

 sample rules

const filters = [
  {
    assertions: [
      { prop: 'to', oper: 'equal', params: ['josefina.benavidez@theeye.io', null] },
      { prop: 'from', oper: 'match', params: [/@theeye\.io/i, null] }
    ],
    event_name: 'resumir'
  },
  {
    assertions: [
      { prop: 'to', oper: 'equal', params: ['support@theeye', null] },
      { prop: 'from', oper: 'match', params: [/@theeye.io/i, null] },
      { prop: 'subject', oper: 'match', params: [ /resum/i ] }
    ],
    event_name: 'resumir'
  },
  {
    assertions: [
      { prop: 'from', oper: 'match', params: [/@theeye\.io/i, null] }
    ],
    event_name: 'ignorar'
  }
]

*/

const { assert } = require('chai')

// NodeJs boilerplate
const main = module.exports = async (args) => {

  const filters = require(process.env.FILTERS_FILE_PATH)
  
  const params = JSON.parse(args[0])
  
  let found = false
  for (let index = 0; index < filters.length && !found; index++) {
    try {
      const condition = filters[index]
      satisfyAllConditions(condition, params)
      found = condition
    } catch (err) {
      console.log(err.message)
      if (err.name === 'AssertionError') {
        // no hace nada
      } else {
        throw err
      }
    }
  }

  const result = {
    data: params, 
    event_name: found?.event_name || process.env.DEFAULT_EVENT_NAME
  }

  // add your code here.

  return result
}

// en cuanto falla sale por exception
const satisfyAllConditions = (condition, params) => {
  for (let index = 0; index < condition.assertions.length; index++) {
    const eval = condition.assertions[index]
    assert.property(params, eval.prop)
    assert[ eval.oper ](params[eval.prop], ...eval.params)
  }
  return true
}

if (require.main === module) {
  main(process.argv.slice(2)).then(console.log).catch(console.error)
}
