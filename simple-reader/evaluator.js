
const { assert } = require('chai')

/**

 en la primera que encuentra termina.
 si llega al final continua por el flow de resumir.

 soporta todas las operaciones que soporta chai
 https://www.chaijs.com/api/assert/

**/
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

// NodeJs boilerplate
const main = async (args) => {
  
  const params = JSON.parse(args[0])
  
  let found = false
  for (let index = 0; index < filters.length && !found; index++) {
    try {
      const condition = filters[index]
      satisfyAllConditions(condition, params)
      found = condition
    } catch (err) {
      if (err.name === 'AssertionError') {
        console.log(err.message)
      } else {
        throw err
      }
    }
  }

  const result = {
    data: params, 
    event_name: found?.event_name || 'resumir'
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
