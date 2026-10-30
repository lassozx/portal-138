export default function ArticleContent({ post, headingRef, headingLevel = 'h1', compact = false }) {
  const Heading = headingLevel
  const publishedAt = post.publishedAt || post.createdAt
  const date = publishedAt ? new Date(publishedAt) : null
  const validDate = date && !Number.isNaN(date.getTime())

  return (
    <article>
      <p className="text-sm font-bold uppercase tracking-widest text-red-700">{post.category?.name || 'Notícias'}</p>
      <Heading ref={headingRef} tabIndex={headingRef ? -1 : undefined} className={`mt-4 break-words text-3xl font-black leading-tight tracking-tight focus:outline-none ${compact ? '' : 'sm:text-5xl'}`}>{post.title}</Heading>
      {post.excerpt && <p className="mt-5 text-lg leading-8 text-slate-600 sm:text-xl">{post.excerpt}</p>}
      <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 border-b border-slate-200 pb-6 text-sm text-slate-500">
        <span>Por <span className="font-semibold text-slate-700">{post.author?.name || 'Redação Portal 138'}</span></span>
        {validDate && <time dateTime={publishedAt}>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(date)}</time>}
      </div>
      {post.coverImage && <img src={post.coverImage} alt="" fetchPriority={compact ? 'auto' : 'high'} className="mt-8 max-h-[32rem] w-full rounded-2xl object-contain" />}
      <div className="mx-auto mt-8 max-w-prose whitespace-pre-wrap break-words text-lg leading-9 text-slate-800">{post.content}</div>
    </article>
  )
}
