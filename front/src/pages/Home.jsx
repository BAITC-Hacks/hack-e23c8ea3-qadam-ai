import './Home.css'

function Home() {
  return (
    <section className="home">
      <h1>Welcome</h1>
      <p className="home__lead">
        Frontend scaffold is ready. Add pages and content here later.
      </p>

      <div className="home__grid">
        <article className="home__block">
          <h2>Section 1</h2>
          <p>Placeholder block for future content.</p>
        </article>
        <article className="home__block">
          <h2>Section 2</h2>
          <p>Placeholder block for future content.</p>
        </article>
        <article className="home__block">
          <h2>Section 3</h2>
          <p>Placeholder block for future content.</p>
        </article>
      </div>
    </section>
  )
}

export default Home
