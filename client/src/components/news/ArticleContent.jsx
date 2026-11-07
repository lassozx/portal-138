export default function ArticleContent({ post, headingRef, headingLevel = 'h1', compact = false }) {
  const Heading = headingLevel
  const publishedAt = post.publishedAt || post.createdAt
  const date = publishedAt ? new Date(publishedAt) : null
  const validDate = date && !Number.isNaN(date.getTime())

  return (
    <article className={`portal-content${compact ? ' portal-content--compact' : ''}`}>
      <div className="portal-content-heading">
        <p className="portal-content-eyebrow">{post.category?.name || 'Notícias'}</p>
        <Heading ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="portal-content-title">{post.title}</Heading>
        {post.excerpt && <p className="portal-content-summary">{post.excerpt}</p>}
        <div className="portal-content-meta">
          <span>Por <span className="portal-content-author">{post.author?.name || 'Redação Portal 138'}</span></span>
          {validDate && <time dateTime={publishedAt}>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(date)}</time>}
        </div>
      </div>
      {post.coverImage && <div className="portal-content-image"><img src={post.coverImage} alt="" fetchPriority={compact ? 'auto' : 'high'} /></div>}
      <div className="portal-content-body">{post.content}</div>
    </article>
  )
}
