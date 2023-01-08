;(() => {
  const animations = [...document.querySelectorAll('.animated')].map(element => ({
    items: element.children,
    index: 0
  }))

  setInterval(() => {
    for (const animation of animations) {
      animation.items[animation.index].classList.remove('animated-active')
      animation.index = (animation.index + 1) % animation.items.length
      animation.items[animation.index].classList.add('animated-active')
    }
  }, 1500)
})()

;(async () => {
  const count = 10
  const load = fetch('/index.json').then(r => r.json())
  let pages = null

  const header = document.querySelector('header')
  const element = document.querySelector('.search')
  const indexElement = document.querySelector('.index')
  const input = element.querySelector('input')
  const suggestions = element.querySelector('ul')
  const suggestionItems = []
  const suggestionLinks = []
  const suggestionLabels = []
  const suggestionImages = []
  let suggestionsIndex = 0
  let results = []

  element.className = 'search'

  input.addEventListener('input', update, { passive: true })
  input.addEventListener('keydown', keydown)

  let suggestionItem, suggestionLink

  for (let i = 0; i < count; i++) {
    const suggestionItem = document.createElement('li')
    const suggestionLink = document.createElement('a')
    const suggestionLabel = document.createElement('span')
    const suggestionImage = document.createElement('img')
    suggestionImage.width = 16
    suggestionImage.height = 16
    suggestionItems.push(suggestionItem)
    suggestionLinks.push(suggestionLink)
    suggestionLabels.push(suggestionLabel)
    suggestionImages.push(suggestionImage)
    suggestionLink.appendChild(suggestionImage)
    suggestionLink.appendChild(suggestionLabel)
    suggestionItem.appendChild(suggestionLink)
    suggestions.appendChild(suggestionItem)
  }

  load.then((data) => {
    pages = data
      .map((page) => ({
        ...page,
        search: normalize(page.title)
      }))

    update()

    if (indexElement) {
      const random = []
      const candidates = pages.filter(page => page.image)

      for (let i = 0, j, k = 0; i < 50; i++, k = 0) {
        while (random.includes(j = Math.round(Math.random() * (candidates.length - 1)))) {
          if (k++ > 1000) {
            break
          }
        }

        random.push(j)
      }

      for (const i of random) {
        const page = candidates[i]
        const randomItem = document.createElement('a')
        const label = document.createElement('span')
        const image = document.createElement('img')

        randomItem.className = 'index-item'

        randomItem.href = page.path
        image.src = page.image
        image.width = 16
        image.height = 16
        label.textContent = page.title

        randomItem.appendChild(image)
        randomItem.appendChild(label)

        indexElement.appendChild(randomItem)
      }
    }
  })

  function update() {
    if (!pages) {
      return
    }

    const query = normalize(input.value)

    if (!query) {
      suggestions.hidden = true
      return
    }

    let i, page, suggestionItem, suggestionLink, suggestionImage, suggestionLabel

    results = []

    for (i = 0; i < pages.length; i++) {
      page = pages[i]
      page.search.includes(query) && results.push(page)
    }

    results
      .sort((a, b) => a.search.indexOf(query) - b.search.indexOf(query))
      .splice(0, count)

    for (i = 0; i < count; i++) {
      suggestionItem = suggestionItems[i]
      suggestionLink = suggestionLinks[i]
      suggestionLabel = suggestionLabels[i]
      suggestionImage = suggestionImages[i]
      page = results[i]

      suggestionItem.classList.toggle('selected', !i)

      if (page) {
        suggestionItem.hidden = false
        suggestionLabel.textContent = page.title
        suggestionLink.href = page.path
        suggestionImage.classList.toggle('hidden', !page.image)
        suggestionImage.src = page.image
      } else {
        suggestionItem.hidden = true
      }
    }

    suggestionsIndex = 0
    suggestions.hidden = false
  }

  function keydown(event) {
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowDown':
        event.preventDefault()
        suggestionItems[suggestionsIndex].classList.remove('selected')
        suggestionsIndex += event.key === 'ArrowDown' ? 1 : -1
        suggestionsIndex += Math.min(0, Math.sign(suggestionsIndex)) * -results.length
        suggestionsIndex = suggestionsIndex % results.length
        suggestionItems[suggestionsIndex].classList.add('selected')
        break

      case 'Enter':
        event.preventDefault()
        window.location.href = suggestionLinks[suggestionsIndex].href
        break
    }
  }

  function normalize(string) {
    return string
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s\s+/g, ' ')
      .trim()
  }
})()