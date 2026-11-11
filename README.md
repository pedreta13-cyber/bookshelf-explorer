# BookShelf Explorer

A client-side React single-page application for searching the Open Library catalog, exploring book details, and saving books to a personal bookshelf.

## Features

- Search millions of Open Library records by title, author, or subject.
- Browse search results with server-side pagination and client-side sorting.
- Open a book detail page with its description and subjects.
- Save and remove books from a personal bookshelf; saved books persist in `localStorage`.
- Responsive layout, loading skeletons, empty states, and retryable API errors.

## Tech stack

- React and Vite
- React Router
- Open Library Search API and Covers API

## Getting started

Requirements: Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To create and preview a production build:

```bash
npm run build
npm run preview
```

No API key or `.env` file is required. The app queries the public [Open Library Search API](https://openlibrary.org/dev/docs/api/search) and retrieves cover images from the [Open Library Covers API](https://openlibrary.org/dev/docs/api/covers).

## Project structure

```text
src/
  App.jsx       App routes, API interactions, and reusable UI components
  main.jsx      React entry point and router
  styles.css    Responsive application styles
index.html      Vite HTML entry point
```

## Notes

Saved books are stored in the current browser's local storage and are not synced across devices. Book data and cover availability are provided by Open Library.
