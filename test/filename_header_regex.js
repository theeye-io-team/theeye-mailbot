
const path = require('path')

const pattern = /filename=(.+)$/

const names = [
  `"You've_invited_to_TheEye.js.html"`,
  'Welcome_to_TheEye.html',
  '"Welcome_to_TheEye.html"',
  '"VTV_AE265GJ_2773602.pdf"',
  '02-VTV_AE265GJ_2773602.pdf',
  '"02-VTV_AE265GJ_2773602.pdf"',
  // errores
  '02-VTV_AE265GJ_2773602.pdf;name=',
  '02-VTV_AE265GJ_2773602.pdf"',
]

const matches = names.map(name => `filename=${name}`.match(pattern))

const filenames = matches.map(list => {
  return (
    list[1]
    .split(';')[0]
    .split('"')
    .join('')
    .replace(/[^\w\-.]/,'_')
  )
})

console.log(filenames)

console.log(filenames.map(f => path.extname(f).replace('.','')))


