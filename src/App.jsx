import React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

const API_BASE = "https://openlibrary.org";
const PAGE_SIZE = 24;
const TOPICS = ["Fantasy", "Romance", "Mystery", "Science fiction", "History"];

function readSavedBooks() {
  try {
    const saved = JSON.parse(localStorage.getItem("bookshelf-explorer:saved") || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.error("Could not read saved books from local storage.", error);
    return [];
  }
}

function coverUrl(coverId, size = "M") {
  return coverId
    ? `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`
    : null;
}

function getWorkId(book) {
  return book.key?.split("/").filter(Boolean).pop();
}

function App() {
  const [savedBooks, setSavedBooks] = useState(readSavedBooks);
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem("bookshelf-explorer:saved", JSON.stringify(savedBooks));
      setStorageError("");
    } catch (error) {
      console.error("Could not save your bookshelf.", error);
      setStorageError("Your browser could not save changes to this bookshelf.");
    }
  }, [savedBooks]);

  function toggleSaved(book) {
    const key = book.key || (book.workId ? `/works/${book.workId}` : "");
    if (!key) return;
    setSavedBooks((current) =>
      current.some((saved) => saved.key === key)
        ? current.filter((saved) => saved.key !== key)
        : [{ ...book, key }, ...current],
    );
  }

  const isSaved = (book) =>
    savedBooks.some((saved) => saved.key === book.key || saved.key === `/works/${book.workId}`);

  return (
    <div className="app-shell">
      <Header savedCount={savedBooks.length} />
      {storageError && <div className="storage-alert">{storageError}</div>}
      <Routes>
        <Route
          path="/"
          element={
            <DiscoverPage
              savedBooks={savedBooks}
              isSaved={isSaved}
              toggleSaved={toggleSaved}
            />
          }
        />
        <Route
          path="/saved"
          element={
            <SavedPage
              books={savedBooks}
              isSaved={isSaved}
              toggleSaved={toggleSaved}
            />
          }
        />
        <Route
          path="/book/:workId"
          element={
            <BookDetailsPage
              isSaved={isSaved}
              toggleSaved={toggleSaved}
            />
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Footer />
    </div>
  );
}

function Header({ savedCount }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" to="/" aria-label="BookShelf Explorer home">
          <span className="brand-mark" aria-hidden="true">
            <BookIcon />
          </span>
          <span>BookShelf<span className="brand-light"> Explorer</span></span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Discover
          </NavLink>
          <NavLink to="/saved" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            My bookshelf <span className="nav-count">{savedCount}</span>
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

function DiscoverPage({ isSaved, toggleSaved }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryFromUrl = searchParams.get("q") || "";
  const pageFromUrl = Number(searchParams.get("page") || 1);
  const [input, setInput] = useState(queryFromUrl);
  const [result, setResult] = useState({ docs: [], numFound: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState("relevance");
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    setInput(queryFromUrl);
  }, [queryFromUrl]);

  useEffect(() => {
    if (!queryFromUrl.trim()) {
      setResult({ docs: [], numFound: 0 });
      setError("");
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    async function fetchBooks() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          q: queryFromUrl,
          page: String(Math.max(1, pageFromUrl)),
          limit: String(PAGE_SIZE),
          fields: "key,title,author_name,first_publish_year,cover_i,edition_count,subject,language",
        });
        const response = await fetch(`${API_BASE}/search.json?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Open Library returned ${response.status}. Please try again.`);
        }
        const data = await response.json();
        setResult({
          docs: Array.isArray(data.docs) ? data.docs : [],
          numFound: data.numFound || data.num_found || 0,
        });
      } catch (fetchError) {
        if (fetchError.name !== "AbortError") {
          console.error("Book search failed.", fetchError);
          setError(fetchError.message || "We couldn't load books. Please try again.");
          setResult({ docs: [], numFound: 0 });
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    fetchBooks();
    return () => controller.abort();
  }, [queryFromUrl, pageFromUrl, retryToken]);

  const books = useMemo(() => {
    const docs = [...result.docs];
    if (sortBy === "title") return docs.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    if (sortBy === "newest") return docs.sort((a, b) => (b.first_publish_year || 0) - (a.first_publish_year || 0));
    if (sortBy === "oldest") return docs.sort((a, b) => (a.first_publish_year || Infinity) - (b.first_publish_year || Infinity));
    return docs;
  }, [result.docs, sortBy]);

  function search(event) {
    event.preventDefault();
    const query = input.trim();
    setSearchParams(query ? { q: query, page: "1" } : {});
  }

  function chooseTopic(topic) {
    setInput(topic);
    setSearchParams({ q: topic, page: "1" });
  }

  function changePage(page) {
    setSearchParams({ q: queryFromUrl, page: String(page) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const totalPages = Math.min(100, Math.ceil(result.numFound / PAGE_SIZE));

  return (
    <main>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> YOUR NEXT CHAPTER STARTS HERE</p>
            <h1>Find a book<br />that <em>moves</em> you.</h1>
            <p className="hero-description">
              Explore millions of books, uncover new favorites, and keep every good read close.
            </p>
            <form className="search-form" onSubmit={search} role="search">
              <SearchIcon />
              <input
                type="search"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Search by title, author, or subject..."
                aria-label="Search books"
              />
              {input && (
                <button className="clear-search" type="button" onClick={() => setInput("")} aria-label="Clear search">
                  ×
                </button>
              )}
              <button className="search-button" type="submit">Search <span aria-hidden="true">→</span></button>
            </form>
            <div className="topic-row">
              <span>Try a topic</span>
              {TOPICS.map((topic) => (
                <button className="topic-chip" key={topic} onClick={() => chooseTopic(topic)} type="button">
                  {topic}
                </button>
              ))}
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="sun-disc" />
            <div className="book-stack stack-back"><span /></div>
            <div className="book-stack stack-mid"><span /></div>
            <div className="book-stack stack-front"><span /></div>
            <div className="art-sparkle sparkle-one">✳</div>
            <div className="art-sparkle sparkle-two">✦</div>
            <div className="art-label">A WORLD<br />BETWEEN<br />THE COVERS</div>
          </div>
        </div>
      </section>

      <section className="content-section" id="results">
        <div className="section-heading">
          <div>
            <p className="eyebrow muted-eyebrow">{queryFromUrl ? "THE LIBRARY IS OPEN" : "A LITTLE INSPIRATION"}</p>
            <h2>{queryFromUrl ? <>Books for <em>“{queryFromUrl}”</em></> : "Where will you wander?"}</h2>
            <p className="section-subtitle">
              {queryFromUrl
                ? `${result.numFound.toLocaleString()} results in the Open Library catalog`
                : "Search millions of books by title, author, or subject to find your next favorite."}
            </p>
          </div>
          {queryFromUrl && (
            <label className="sort-control">
              <span>Sort by</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="relevance">Relevance</option>
                <option value="title">Title A–Z</option>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
          )}
        </div>

        {loading && <LoadingState />}
        {!loading && error && (
          <div className="notice error-notice" role="alert">
            <span>{error}</span>
            <button type="button" className="text-button" onClick={() => setRetryToken((current) => current + 1)}>
              Try again
            </button>
          </div>
        )}
        {!loading && !error && queryFromUrl && books.length > 0 && (
          <>
            <BookGrid books={books} isSaved={isSaved} toggleSaved={toggleSaved} />
            {totalPages > 1 && (
              <Pagination page={pageFromUrl} totalPages={totalPages} onChange={changePage} />
            )}
          </>
        )}
        {!loading && !error && queryFromUrl && books.length === 0 && (
          <EmptyState
            title="No books found"
            message="Try a different title, author, or subject. Sometimes a small change makes all the difference."
            action={<button className="button button-dark" onClick={() => { setInput(""); setSearchParams({}); }}>Clear search</button>}
          />
        )}
        {!loading && !error && !queryFromUrl && <DiscoverPrompt onChooseTopic={chooseTopic} />}
      </section>
    </main>
  );
}

function DiscoverPrompt({ onChooseTopic }) {
  return (
    <div className="discover-cards">
      {[
        { icon: "✦", title: "Get lost in a story", text: "Browse fantasy, romance, and worlds beyond.", topic: "fantasy", tone: "sage" },
        { icon: "⌕", title: "Follow your curiosity", text: "Find a book about something brand new.", topic: "science", tone: "peach" },
        { icon: "♡", title: "Meet a new favorite", text: "Search for authors you already love.", topic: "favorite authors", tone: "lavender" },
      ].map((card) => (
        <button className={`discover-card ${card.tone}`} key={card.title} onClick={() => onChooseTopic(card.topic)} type="button">
          <span className="discover-icon">{card.icon}</span>
          <span className="discover-card-title">{card.title}</span>
          <span className="discover-card-text">{card.text}</span>
          <span className="discover-arrow" aria-hidden="true">↗</span>
        </button>
      ))}
    </div>
  );
}

function BookGrid({ books, isSaved, toggleSaved }) {
  return (
    <div className="book-grid">
      {books.map((book) => (
        <BookCard key={book.key} book={book} saved={isSaved(book)} onToggleSaved={toggleSaved} />
      ))}
    </div>
  );
}

function BookCard({ book, saved, onToggleSaved }) {
  const workId = getWorkId(book);
  const image = coverUrl(book.cover_i);
  const author = book.author_name?.[0] || "Unknown author";
  return (
    <article className="book-card">
      <div className="cover-wrap">
        <Link to={workId ? `/book/${workId}` : "#"} className="cover-link" aria-label={`View ${book.title}`}>
          {image ? (
            <img className="book-cover" src={image} alt={`Cover of ${book.title}`} loading="lazy" />
          ) : (
            <CoverPlaceholder title={book.title} author={author} />
          )}
        </Link>
        <button
          type="button"
          className={`favorite-button ${saved ? "is-saved" : ""}`}
          onClick={() => onToggleSaved(book)}
          aria-label={saved ? `Remove ${book.title} from bookshelf` : `Save ${book.title} to bookshelf`}
          title={saved ? "Remove from bookshelf" : "Save to bookshelf"}
        >
          <HeartIcon filled={saved} />
        </button>
      </div>
      <div className="book-card-info">
        <Link className="book-title" to={workId ? `/book/${workId}` : "#"}>{book.title || "Untitled"}</Link>
        <p className="book-author">{author}</p>
        <div className="book-meta">
          {book.first_publish_year && <span>{book.first_publish_year}</span>}
          {book.edition_count > 0 && <span>{book.edition_count} {book.edition_count === 1 ? "edition" : "editions"}</span>}
        </div>
      </div>
    </article>
  );
}

function CoverPlaceholder({ title, author }) {
  return (
    <div className="cover-placeholder">
      <span className="placeholder-mark"><BookIcon /></span>
      <span className="placeholder-title">{title}</span>
      <span className="placeholder-author">{author}</span>
    </div>
  );
}

function SavedPage({ books, isSaved, toggleSaved }) {
  return (
    <main className="page-main">
      <div className="page-heading">
        <p className="eyebrow muted-eyebrow">YOUR PERSONAL COLLECTION</p>
        <h1>My <em>bookshelf</em></h1>
        <p className="section-subtitle">
          {books.length
            ? `${books.length} ${books.length === 1 ? "book" : "books"} saved for your next reading adventure.`
            : "Keep the books that catch your eye, all in one place."}
        </p>
      </div>
      {books.length ? (
        <BookGrid books={books} isSaved={isSaved} toggleSaved={toggleSaved} />
      ) : (
        <EmptyState
          title="Your bookshelf is waiting"
          message="When a book catches your eye, tap the heart to save it here for later."
          action={<Link className="button button-dark" to="/">Explore books <span aria-hidden="true">→</span></Link>}
        />
      )}
    </main>
  );
}

function BookDetailsPage({ isSaved, toggleSaved }) {
  const { workId } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchDetails() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_BASE}/works/${encodeURIComponent(workId)}.json`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Open Library returned ${response.status}.`);
        const data = await response.json();
        setBook(data);
      } catch (fetchError) {
        if (fetchError.name !== "AbortError") {
          console.error("Could not load book details.", fetchError);
          setError(fetchError.message || "We couldn't load this book.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    fetchDetails();
    return () => controller.abort();
  }, [workId, retryToken]);

  if (loading) return <main className="page-main"><LoadingState /></main>;
  if (error || !book) {
    return (
      <main className="page-main">
        <div className="notice error-notice" role="alert">{error || "This book could not be found."}</div>
        <button className="button button-dark back-button" onClick={() => setRetryToken((current) => current + 1)}>Try again</button>
        <button className="back-link back-button" onClick={() => navigate(-1)}>← Go back</button>
      </main>
    );
  }

  const normalized = {
    key: `/works/${workId}`,
    workId,
    title: book.title,
    cover_i: book.covers?.find((id) => id > 0),
    subject: book.subjects || [],
  };
  const description = typeof book.description === "string"
    ? book.description
    : book.description?.value || "No description is available for this book yet.";
  const saved = isSaved(normalized);

  return (
    <main className="page-main detail-page">
      <button className="back-link" onClick={() => navigate(-1)}>← Back to books</button>
      <article className="detail-layout">
        <div className="detail-cover-wrap">
          {normalized.cover_i
            ? <img className="detail-cover" src={coverUrl(normalized.cover_i, "L")} alt={`Cover of ${book.title}`} />
            : <CoverPlaceholder title={book.title} author="Open Library" />}
        </div>
        <div className="detail-copy">
          <p className="eyebrow muted-eyebrow">FROM THE OPEN LIBRARY</p>
          <h1>{book.title}</h1>
          {book.subtitle && <p className="detail-subtitle">{book.subtitle}</p>}
          {book.first_publish_date && <p className="detail-date">First published {book.first_publish_date}</p>}
          <div className="detail-description">{description}</div>
          {book.subjects?.length > 0 && (
            <div className="subject-list">
              <h2>Explore these subjects</h2>
              <div className="subject-chips">
                {book.subjects.slice(0, 8).map((subject) => <span className="subject-chip" key={subject}>{subject}</span>)}
              </div>
            </div>
          )}
          <div className="detail-actions">
            <button className={`button ${saved ? "button-saved" : "button-dark"}`} onClick={() => toggleSaved(normalized)}>
              <HeartIcon filled={saved} /> {saved ? "Saved to bookshelf" : "Save to bookshelf"}
            </button>
            <a className="text-link" href={`https://openlibrary.org/works/${encodeURIComponent(workId)}`} target="_blank" rel="noreferrer">
              View on Open Library ↗
            </a>
          </div>
        </div>
      </article>
    </main>
  );
}

function Pagination({ page, totalPages, onChange }) {
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    return start + index;
  }).filter((number) => number <= totalPages);
  return (
    <nav className="pagination" aria-label="Search results pages">
      <button className="page-button" type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">←</button>
      {pages.map((number) => (
        <button
          className={`page-button ${number === page ? "current-page" : ""}`}
          key={number}
          type="button"
          onClick={() => onChange(number)}
          aria-current={number === page ? "page" : undefined}
        >
          {number}
        </button>
      ))}
      <button className="page-button" type="button" onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="Next page">→</button>
      <span className="page-count">Page {page} of {totalPages}</span>
    </nav>
  );
}

function LoadingState() {
  return (
    <div className="loading-grid" role="status" aria-label="Loading books">
      {Array.from({ length: 8 }, (_, index) => (
        <div className="skeleton-card" key={index}>
          <div className="skeleton-cover" />
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, message, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><BookIcon /></span>
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </div>
  );
}

function NotFoundPage() {
  return (
    <main className="page-main">
      <EmptyState
        title="This page wandered off"
        message="We couldn't find the page you were looking for."
        action={<Link className="button button-dark" to="/">Back to discovery</Link>}
      />
    </main>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <span className="footer-brand"><BookIcon /> BookShelf Explorer</span>
        <span>Made for curious readers.</span>
        <a href="https://openlibrary.org/developers/api" target="_blank" rel="noreferrer">Powered by Open Library ↗</a>
      </div>
    </footer>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4.5 5.5c2.8-.9 5.3-.5 7.5 1.2v13c-2.2-1.7-4.7-2.1-7.5-1.2v-13Z" />
      <path d="M19.5 5.5c-2.8-.9-5.3-.5-7.5 1.2v13c2.2-1.7 4.7-2.1 7.5-1.2v-13Z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

function HeartIcon({ filled = false }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} aria-hidden="true">
      <path d="M20.8 8.8c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11A4.6 4.6 0 0 1 12 6.3a4.6 4.6 0 0 1 8.8 2.5Z" />
    </svg>
  );
}

export default App;
