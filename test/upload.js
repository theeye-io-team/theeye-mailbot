

const api = require('./lib/api')

const file = process.argv[2]

setTimeout( async () => {

  const response = await api.upload({ from: 'test@theeye.io' }, __dirname + file )
  console.log(response)

},0)
