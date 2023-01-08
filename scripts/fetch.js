const crypto = require('crypto')
const fs = require('fs-extra')
const fetch = require('node-fetch')
const json = require('big-json')
const { default: wiki } = require('wikijs')
const { DurationEstimator } = require('duration-estimator')

const {
  CACHE_PATH,
  loadCache,
  saveCache,
  formatDuration,
  escapeRegExp
} = require('./common')

const CACHE_SAVE_INTERVAL = 1000
const BASE_URL = 'https://minecraft.fandom.com'
const API_URL = `${BASE_URL}/api.php`
const API_PAGE_LIMIT = 500
const API_BATCH_COUNT = 50
const WIKI_URL_PATTERN = new RegExp(`(?:\\b${escapeRegExp(BASE_URL)})?\\/wiki\\/`, 'g')
const STYLESHEET_URLS = [
  `${BASE_URL}/load.php?lang=en&modules=ext.cite.styles%7Cext.fandom.ArticleInterlang.css%7Cext.fandom.CreatePage.css%7Cext.fandom.FandomEmbedVideo.css%7Cext.fandom.GlobalComponents.CommunityHeader.css%7Cext.fandom.GlobalComponents.CommunityHeaderBackground.css%7Cext.fandom.GlobalComponents.GlobalComponentsTheme.light.css%7Cext.fandom.GlobalComponents.GlobalFooter.css%7Cext.fandom.GlobalComponents.GlobalNavigation.css%7Cext.fandom.GlobalComponents.GlobalNavigationTheme.default.css%7Cext.fandom.GlobalComponents.StickyNavigation.css%7Cext.fandom.HighlightToAction.css%7Cext.fandom.Thumbnails.css%7Cext.fandom.UserPreferencesV2.css%7Cext.fandom.bannerNotifications.desktop.css%7Cext.fandom.quickBar.css%7Cext.fandomVideo.css%7Cext.staffSig.css%7Cext.visualEditor.desktopArticleTarget.noscript%7Cjquery.makeCollapsible.styles%7Cjquery.tablesorter.styles%7Cmediawiki.page.gallery.styles%7Cskin.fandomdesktop.CargoTables-ext.css%7Cskin.fandomdesktop.FanFeed.css%7Cskin.fandomdesktop.Math.css%7Cskin.fandomdesktop.rail.css%7Cskin.fandomdesktop.rail.popularPages.css%7Cskin.fandomdesktop.styles%7Cvendor.bootstrap.popover.css&only=styles&skin=fandomdesktop`,
  `${BASE_URL}/load.php?lang=en&modules=ext.gadget.dungeonsWiki%2CearthWiki%2Csite-styles%2Csound-styles&only=styles&skin=fandomdesktop`,
  `${BASE_URL}/load.php?lang=en&modules=site.styles&only=styles&skin=fandomdesktop`
]

;(async () => {
  console.log('Loading cache...')

  await fs.ensureDir(CACHE_PATH)

  const api = wiki({ apiUrl: API_URL })
  const cache = await loadCache()
  let pool

  console.log('Fetching pages info...')

  const pages = await aggregate(api, {
    action: 'query',
    generator: 'allpages',
    prop: 'info',
    inprop: 'url',
    // gapfilterredir: 'nonredirects',
    rvprop: 'content',
    rvparse: '',
    redirects: undefined
  }, 'pages', 'gap', (aggregated) => {
    console.log(`Fetched ${aggregated} pages...`)
  })

  pool = []

  for (const page of pages) {
    const cached = cache.pages[page.pageid] || (cache.pages[page.pageid] = {})

    cached.touched !== page.touched && pool.push(page)
    cached.title = page.title
    cached.url = page.fullurl
    cached.path = `/${page.fullurl.replace(WIKI_URL_PATTERN, '')}`
  }

  pool.splice(5000)

  console.log('Fetching pages content...')

  await fs.ensureDir(`${CACHE_PATH}/pages`)

  let poolIndex = 0
  let fetchedPages = 1

  const estimator =  new DurationEstimator(50)

  const fetchPage = async () => {
    const page = pool[poolIndex++]

    if (!page) {
      return
    }

    const cached = cache.pages[page.pageid]

    try {
      let result = await api.api({
        action: 'parse',
        prop: 'text',
        pageid: page.pageid
      })

      let content = resolvePaths(result.parse.text['*'], cache.assets)

      await fs.writeFile(`${CACHE_PATH}/pages/${page.pageid}.html`, content)
      cached.touched = page.touched
      cached.image = resolveImage(content) || cached.image

      console.log(
        `${fetchedPages++}/${pool.length} ` +
        `(${formatDuration(estimator.estimate(fetchedPages / pool.length))} remaining) ` +
        `Fetched "${page.title}"`
      )
      // await fetchedPages % CACHE_SAVE_INTERVAL || saveCache(cache)

      result = undefined
      content = undefined
      await fetchPage()
    } catch (error) {
      console.error(error)
    }
  }

  estimator.update(0)

  await Promise.all(pool.slice(0, API_BATCH_COUNT).map(() => fetchPage()))

  let fetchedAssets = 0
  pool = []

  for (const url of STYLESHEET_URLS) {
    cache.assets[url] = assetPath(url, 'css')
  }

  console.log('Saving cache...')

  await saveCache(cache)

  console.log('Fetching assets...')

  await Promise.all(Object.entries(cache.assets).map(async ([url, path]) => {
    (await fs.pathExists(`${CACHE_PATH}${path}`)) || pool.push([url, path])
  }))

  await fs.ensureDir(`${CACHE_PATH}/assets`)

  await Promise.all(pool.map(async ([url, path]) => {
    const response = await fetch(url)
    const data = new Uint8Array(await response.arrayBuffer())
    await fs.writeFile(`${CACHE_PATH}${path}`, data)
    console.log(`${++fetchedAssets}/${pool.length} Fetched "${path}"`)
  }))
})()

function aggregate({ api }, params, list, prefix, callback = () => {}, results = []) {
  params[prefix + 'limit'] = API_PAGE_LIMIT

  return api(params).then(res => {
    const queryResults = Object.values(res.query[list])
    const nextResults = [...results, ...queryResults]
    const continueWith = res['query-continue'] || res.continue

    callback(nextResults.length, nextResults.length - results.length)

    if (continueWith) {
      const nextFromKey = (
        (continueWith[list] && continueWith[list][prefix + 'from']) ||
        (continueWith[list] && continueWith[list][prefix + 'continue']) ||
        (continueWith[`all${list}`] && continueWith[`all${list}`][prefix + 'from']) ||
        (continueWith[`all${list}`] && continueWith[`all${list}`][prefix + 'continue']) ||
        continueWith[prefix + 'continue']
      )

      params[prefix + 'continue'] = nextFromKey
      params[prefix + 'from'] = nextFromKey

      return aggregate({ api }, params, list, prefix, callback, nextResults)
    }

    return nextResults
  })
}

function assetPath(url, extension = '') {
  return `/assets/${
    crypto.createHash('md5').update(url).digest('hex')
  }.${
    extension || url.replace(/^.+?\.(png|jpe?g|gif|webp|svg|css).*?$/i, '$1')
  }`
}

function resolvePaths(source, assets) {
  return resolveCSSPaths(source, assets).replace(WIKI_URL_PATTERN, '/')
}

function resolveCSSPaths(source, assets) {
  return source.replace(/url\(\s*["']?([^)]+\.(?:png|jpe?g|gif|webp|svg)[^)]*)["']?\s*\)/gi, (_, url) => {
    if (!(url in assets)) {
      assets[url] = assetPath(url)
    }

    return `url(${assets[url]})`
  })
}

function resolveImage(source) {
  const headerIndex = source.indexOf('mcwiki-header')
  const match = headerIndex >= 0 && source.slice(headerIndex).match(/\bsrc="([^"]+\/)\d+(\?cb=\d+)"/)

  if (match) {
    return match[1] + '32' + match[2]
  } else {
    return undefined
  }
}
