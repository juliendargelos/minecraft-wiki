addEventListener('DOMContentLoaded', () => {
  ;(async () => {
    const animations = [...document.querySelectorAll('.animated')]
      .map(element => ({
        items: [...element.children].filter(i => i.querySelector('img')),
        index: 0
      }))
      .filter(({ items }) => items.length > 1)

    const loadedAnimations = []

    for (const animation of animations) {
      Promise
        .all(animation.items.map((item, i) => new Promise((resolve) => {
          const image = item.querySelector('img')
          image.setAttribute('alt', '')
          item.style.opacity = i === 0 ? '1' : '0.1'

          const load = () => {
            image.removeEventListener('load', load)
            resolve()
          }

          if (image.complete) {
            load()
          } else {
            image.addEventListener('load', load)
          }
        })))
        .then(() => setTimeout(() => {
          for (const item of animation.items) {
            item.style.opacity = ''
          }

          loadedAnimations.push(animation)
        }, 200))
    }

    setInterval(() => {
      for (const animation of loadedAnimations) {
        animation.items[animation.index].classList.remove('animated-active')
        animation.index = (animation.index + 1) % animation.items.length
        animation.items[animation.index].classList.add('animated-active')
      }
    }, 1500)
  })()

  ;(async () => {
    const count = 15
    const indexCount = 100
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

    if (indexElement) {
      indexElement.innerHTML = new Array(indexCount)
        .fill(null)
        .map(() => (
          `<span class="index-item" style="opacity:.5">${
            `&nbsp;`.repeat(~~(10 + Math.random() * 30))
          }</span>`)
        )
        .join('')
    }

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

        for (let i = 0, j, k = 0; i < indexCount; i++, k = 0) {
          while (random.includes(j = Math.round(Math.random() * (candidates.length - 1)))) {
            if (k++ > 1000) {
              break
            }
          }

          random.push(j)
        }

        indexElement.innerHTML = ''

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
        .splice(count)

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
      suggestions.hidden = suggestionItems[0].hidden
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
})
