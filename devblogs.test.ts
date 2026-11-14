import { afterEach, describe, expect, it } from 'vitest'
import { parserLoader, resetPage, visit } from '#scraper-test'

// The parser, evaluated with the helpers it is injected with, as a scrape runs it.
const load = parserLoader(__dirname)

afterEach(resetPage)

describe('listings', () => {
  it.each([
    ['devblogs.js', 'parseDevBlogs', 'https://devblogs.microsoft.com/oldnewthing/', '<a class="excerpt-title" href="https://devblogs.microsoft.com/oldnewthing/20261106-00/?p=1">A post</a>', 'https://devblogs.microsoft.com/oldnewthing/20261106-00/?p=1'],
    ['devblogs.js', 'parseDevBlogs', 'https://devblogs.microsoft.com/oldnewthing/tag/code/', '<article id="post-1"><a rel="bookmark" href="https://devblogs.microsoft.com/oldnewthing/20261106-00/?p=1">A post</a></article>', 'https://devblogs.microsoft.com/oldnewthing/20261106-00/?p=1'],
  ])('%s links %s to what it lists, as the default parse finds no links on a page that is no article', async (file, parser, url, body, listed) => {
    visit(url, body)
    expect(await load(file, [parser])[parser]()).toEqual({ listing: true, links: [{ url: listed, score: 1 }] })
  })

  it.each([
    ['devblogs.js', 'parseDevBlogs', 'https://devblogs.microsoft.com/oldnewthing/'],
    ['devblogs.js', 'parseDevBlogs', 'https://devblogs.microsoft.com/oldnewthing/tag/code/'],
  ])('%s marks a page it does not read, leaving its content and links to the default parse (%s %s)', async (file, name, url) => {
    const parse = load(file, [name])[name]
    visit(url, '')
    expect(await parse()).toEqual({ listing: true })
  })

  it.each([
    ['devblogs.js', 'parseDevBlogs', 'https://devblogs.microsoft.com/oldnewthing/20261102-00/?p=112818', '<article id="post-1"><h1>Post</h1><div class="entry-content"><p>Words</p></div></article>'],
  ])('%s leaves a post to read (%s %s)', (file, name, url, body) => {
    visit(url, body)
    const parsed = load(file, [name])[name]()
    expect(parsed.title).toBe('Post')
    expect(parsed.listing).toBeUndefined()
  })
})

describe('blogs', () => {
  it('reads a Microsoft developer blog post, then each comment with its time from the HTML comment beside it', () => {
    const { parseDevBlogs } = load('devblogs.js', ['parseDevBlogs'])
    visit('https://devblogs.microsoft.com/oldnewthing/20261102-00/?p=112818/', `
      <article id="post-112818"><h1>Sneaking into the auditorium</h1><div class="entry-content"><p>The launch.</p></div></article>
      <ul class="commentlist">
        <li class="comment depth-1" id="li-comment-1"><article id="comment-1">
          <header><span class="author-name"> Peter </span><span class="comment-date"><!-- <time pubdate datetime="2026-11-02T10:29:06-08:00"> </time> --> 2 hours ago</span>
          <span class="vote_counts"> 3</span></header>
          <div class="comment-content"><p>I remember.</p></div></article>
          <ul class="children"><li class="comment depth-2" id="li-comment-2"><article id="comment-2">
            <header><span class="author-name">Letao</span></header><div class="comment-content"><p>Me too.</p></div>
          </article></li></ul>
        </li>
      </ul>`)
    expect(parseDevBlogs()).toEqual({
      title: 'Sneaking into the auditorium',
      content: [
        'The launch.',
        '<comment depth="0" author="Peter" score="3" time="2026-11-02T18:29:06.000Z" url="https://devblogs.microsoft.com/oldnewthing/20261102-00/?p=112818/#comment-1">',
        'I remember.',
        '<comment depth="1" author="Letao" url="https://devblogs.microsoft.com/oldnewthing/20261102-00/?p=112818/#comment-2">',
        'Me too.',
      ],
    })
  })
})

describe('authors', () => {
  const head = (name: string, url: string) => `<post author="${name}" author-url="${url}">`

  it('heads a Microsoft developer blog post with its author, whose comments have no page', () => {
    const { parseDevBlogs } = load('devblogs.js', ['parseDevBlogs'])
    const authorUrl = 'https://devblogs.microsoft.com/oldnewthing/author/oldnewthing'
    visit('https://devblogs.microsoft.com/oldnewthing/20261105-00/?p=1', `
      <article id="post-1"><h1>A</h1><div class="entry-content"><p>Text.</p></div>
        <a class="read-more" aria-label="Raymond" href="${authorUrl}"></a>
        <a data-bi-area="body_author_bottom" class="read-more" href="${authorUrl}">Raymond Chen</a></article>`)
    expect(parseDevBlogs()).toEqual({ title: 'A', content: [head('Raymond Chen', authorUrl), 'Text.'], links: [{ url: authorUrl, score: 1 }] })
  })
})

describe('author pages', () => {
  const ranked = (...urls: string[]) => ({ listing: true, links: urls.map((url, rank) => ({ url, score: 1 / (1 + rank / 10) })) })

  it.each([
    ['devblogs.js', 'parseDevBlogs', 'https://devblogs.microsoft.com/oldnewthing/author/oldnewthing/', 'https://devblogs.microsoft.com/oldnewthing/20261028-00/?p=1/', `
      <article id="post-1"><h3><a class="single-click" rel="bookmark" href="https://devblogs.microsoft.com/oldnewthing/20261028-00/?p=1/">One</a></h3><div class="entry-content"><p>Excerpt.</p></div></article>`],
  ])('links an author\'s page of %s to each of their works', (file, parser, url, work, body) => {
    visit(url, body)
    expect(load(file, [parser])[parser]()).toEqual(ranked(work))
  })
})
