// When a comment was posted: the page shows only how long ago ("2 hours ago"), keeping the time itself in an HTML
// comment beside it (<!-- <time pubdate datetime="2026-11-02T10:29:06-08:00"> </time> -->).
function devblogsCommentTime(comment) {
  const date = comment.querySelector('.comment-date')
  for (const node of date?.childNodes || []) {
    const time = node.nodeType === Node.COMMENT_NODE && node.textContent.match(/datetime="([^"]+)"/)
    if (time) {
      return isoTime(time[1])
    }
  }
  return null
}

// A post on one of Microsoft's developer blogs (The Old New Thing: /oldnewthing/20261102-00/?p=112818) reads as its
// headline, a head with its authors, each paragraph, heading, list item, code block and picture of its body, then each
// comment, its head (see commentBlock), with its depth (its depth-N class, from 1), author, votes, time and own link,
// then its paragraphs. A comment's author has no page. An author's page (/oldnewthing/author/oldnewthing/) links to each
// of their posts it shows. A blog's home page (/oldnewthing/) and tags (/oldnewthing/tag/code/) are
// not read, but link to each post they show.
function parseDevBlogs(_profileId) {
  if (location.hostname !== 'devblogs.microsoft.com') {
    return null
  }
  if (location.pathname.includes('/author/') || /^\/[^/]+\/(?:tag\/.*)?$/.test(location.pathname)) {
    return listingOf(linkUrls('article[id^="post-"] a[rel="bookmark"], a.excerpt-title')) ?? { listing: true }
  }
  const post = document.querySelector('article[id^="post-"]')
  const body = post?.querySelector('.entry-content')
  if (!body) {
    return null
  }
  const content = textBlocks(body, { lists: true })
  const page = location.href.split('#')[0]
  for (const comment of document.querySelectorAll('.commentlist li.comment')) {
    const own = comment.querySelector(':scope > article')
    if (!own) {
      continue
    }
    const depth = Number(comment.className.match(/\bdepth-(\d+)\b/)?.[1] || 1) - 1
    const score = Number.parseInt(own.querySelector('.vote_counts')?.textContent, 10)
    content.push(commentBlock({
      depth,
      author: own.querySelector('.author-name')?.innerText.trim() || '[deleted]',
      score,
      time: devblogsCommentTime(own),
      url: own.id && `${page}#${own.id}`,
    }), ...textBlocks(own.querySelector('.comment-content') || own, { lists: true }))
  }
  return withAuthors({
    title: post.querySelector('h1')?.innerText.trim() || document.querySelector('h1')?.innerText.trim() || document.title,
    content,
  }, linkedAuthors('a[data-bi-area="body_author_bottom"]'))
}

// The parser a scrape calls.
registerParser(parseDevBlogs)
