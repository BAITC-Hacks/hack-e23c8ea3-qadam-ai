import './Header.css'

function Header() {
  return (
    <header className="header">
      <div className="header__inner">
        <a href="/" className="header__logo">
          Qadam
        </a>
        <nav className="header__nav">
          <a href="/">Home</a>
          <a href="#courses">Courses</a>
          <a href="#about">About</a>
        </nav>
      </div>
    </header>
  )
}

export default Header
