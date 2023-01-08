const fs = require('fs-extra')
const json = require('big-json')

const ROOT_PATH = `${__dirname}/..`
const CACHE_PATH = `${ROOT_PATH}/.cache`
const SRC_PATH = `${ROOT_PATH}/src`
const OUTPUT_PATH = `${ROOT_PATH}/dist`

let savingCache = Promise.resolve()

function loadCache() {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(`${CACHE_PATH}/cache.json`)
    const parseStream = json.createParseStream()
    readStream.on('error', reject)
    parseStream.on('error', reject)
    parseStream.on('data', resolve)
    readStream.pipe(parseStream)
  }).catch(() => ({
    pages: {},
    assets: {}
  }))
}

async function saveCache(cache) {
  await savingCache

  const writeStream = fs.createWriteStream(`${CACHE_PATH}/cache.json`)
  const stringifyStream = json.createStringifyStream({ body: cache })
  stringifyStream.pipe(writeStream)

  savingCache = new Promise(resolve => stringifyStream.on('close', () => {
    writeStream.end()
    resolve()
  }))

  await savingCache
}

function formatDuration(duration) {
  duration /= 1000

  const hours = ~~(duration / 60 / 60)
  const minutes = ~~((duration - hours * 60 * 60) / 60)
  const seconds = ~~(duration - minutes * 60)

  return [
    hours && `${hours}h`,
    minutes && `${minutes}m`,
    `${seconds}s`,
  ].filter(Boolean).join(' ')
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

module.exports = {
  ROOT_PATH,
  CACHE_PATH,
  SRC_PATH,
  OUTPUT_PATH,

  loadCache,
  saveCache,
  formatDuration,
  escapeRegExp
}
