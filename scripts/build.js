const fs = require('fs-extra')
const ejs = require('ejs')

const {
  CACHE_PATH,
  SRC_PATH,
  OUTPUT_PATH,
  loadCache
} = require('./common')

;(async () => {
  console.log('Loading cache and templates...')

  const [
    cache,
    layoutTemplate,
    pageTemplate,
    indexTemplate
  ] = await Promise.all([
    loadCache(),
    fs.readFile(`${SRC_PATH}/layout.ejs`).then(t => t.toString()),
    fs.readFile(`${SRC_PATH}/page.ejs`).then(t => t.toString()),
    fs.readFile(`${SRC_PATH}/index.ejs`).then(t => t.toString()),
  ])

  const pages = Object
    .entries(cache.pages)
    .sort(([_, a], [__, b]) => a.title.localeCompare(b.title))

  await fs.remove(OUTPUT_PATH)
  await fs.ensureDir(OUTPUT_PATH)

  const stylesheets = Object
    .values(cache.assets)
    .filter(asset => asset.endsWith('.css'))

  console.log('Generating pages...')

  let generatedPages = 1

  for (let i = 0; i < pages.length;) {
    const chunk = []

    while (chunk.length < 500 && i < pages.length) {
      chunk.push(pages[i++])
    }

    await Promise.all(chunk.map(async ([id, page]) => {
      let content

      try {
        content = (await fs.readFile(`${CACHE_PATH}/pages/${id}.html`)).toString()
      } catch (_) {
        console.log(`${generatedPages++}/${pages.length} Unavailable "${page.title}"`)
        return
      }

      await fs.ensureDir(`${OUTPUT_PATH}${page.path}`)

      await fs.writeFile(
        `${OUTPUT_PATH}${page.path}/index.html`,
        render(pageTemplate, layoutTemplate, { stylesheets, page: {
          ...page,
          content: transform(content)
        } })
      )

      console.log(`${generatedPages++}/${pages.length} Generated "${page.title}"`)
    }))
  }

  await Promise.all([
    fs.copy(`${CACHE_PATH}/assets`, `${OUTPUT_PATH}/assets`),
    fs.copy(`${SRC_PATH}/index.js`, `${OUTPUT_PATH}/index.js`),
    fs.copy(`${SRC_PATH}/index.css`, `${OUTPUT_PATH}/index.css`),
    fs.writeFile(
      `${OUTPUT_PATH}/index.html`,
      render(indexTemplate, layoutTemplate, { stylesheets, pages })
    ),
    fs.writeJSON(`${OUTPUT_PATH}/index.json`, pages.map(([_, page]) => ({
      title: page.title,
      path: page.path,
      image: page.image
    })))
  ])
})()

function render(template, layout, params) {
  return ejs.render(layout, {
    ...params,
    content: ejs.render(template, params)
  })
}

function transform(source) {
  return source
    .replace(/<img /g, '<img crossorigin="anonymous" referrerpolicy="no-referrer" ')
    .replace(/<audio /g, '<audio crossorigin="anonymous" ')
    .replace(/<video /g, '<video crossorigin="anonymous" ')
    .replace(/\bsrc="[^"]+"([^<>]+)\bdata-(src="[^"]+")/g, '$1$2')
    .replace(/\bdata-(src="[^"]+")([^<>]+)\bsrc="[^"]+"/g, '$1$2')
}
