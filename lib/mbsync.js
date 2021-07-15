const path = require('path')
const spawn = require('child_process').spawn

const binaryPath = process.env.MBSYNC_PATH || path.join(process.env.NODE_PATH,'lib','mbsync.sh')

const main = module.exports = async (action) => {

	await new Promise((resolve, reject) => {
		const mbsync = spawn(binaryPath, [], {env: {
			MAILBOT_WORKING_DIRECTORY:'/home/damian/Work/theeye-projects/github/theeye-mailbot/mailbot',
			MBSYNC_SYNC_ACTION:action,
			MBSYNC_CONFIG_FILE:'/home/damian/Work/theeye-projects/github/theeye-mailbot/config/mbsync.cfg'
		}})

		mbsync.stdout.on('data', (data) => {
			console.log(`stdout: ${data}`)
		})

		mbsync.stderr.on('data', (data) => {
			console.error(`stderr: ${data}`)
		})

		mbsync.on('close', (code) => {
      resolve()
		})

		mbsync.on('error', (err) => {
      reject(err)
		})
	})
}

if (require.main === module) {
	main(
		process.argv[2],
		process.argv[3]
	).then(console.log).catch(console.error)
}