const mbsync = require('lib/mbsync')

const main = async (action) => {
    await mbsync(action)
}

main(process.argv[2]).then().catch()