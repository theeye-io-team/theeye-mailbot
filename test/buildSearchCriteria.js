const helpers = require('../lib/helpers')
const config = require('../lib/config').decrypt()


const main = () => {

    const searchCriteria = helpers.buildSearchCriteria(['asd','dsa',123], config.searchCriteria)

    console.log(searchCriteria)
}

main()