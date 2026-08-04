import Link from 'next/link'

export default function HomePage() {
  return (
    <main style={{padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: 640}}>
      <h1>sanity-plugin-guided-tours — example app</h1>
      <p>
        This is the M1 example app: an embedded Sanity Studio with the{' '}
        <code>guidedTours()</code> plugin registered, and a placeholder page
        that fetches one tour by slug.
      </p>
      <ul>
        <li>
          <Link href="/studio">Open the embedded Studio</Link> — create a{' '}
          <code>guidedTour</code> document and give it a slug.
        </li>
        <li>
          <Link href="/tours/dynamic-365-sales">View a tour by slug</Link> —
          swap <code>dynamic-365-sales</code> for whatever slug you seeded in
          the Studio; this route 404s until a matching document exists.
        </li>
      </ul>
      <p>
        No content is seeded yet, and this repo&apos;s demo Sanity project
        isn&apos;t provisioned for every environment that builds this app —
        copy <code>.env.example</code> to <code>.env.local</code> and fill in
        a project you have access to before either link will do anything.
      </p>
    </main>
  )
}
