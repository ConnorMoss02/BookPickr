# 📚 BookPickr

**Your shortcut to a better bookshelf**

---

## Why I Built This

I’ve always loved discovering great books — but every time I look at a massive list like the **New York Times Top 100** or a “Books to Read Before You Die” compilation, I get stuck.  
How do you actually _choose_ which one to read next?

Scrolling through 100 titles feels overwhelming.  
So I figured… why not make it simple?  
What if I just compare **two books at a time**?

That’s where **BookPickr** came in.  
It’s my new way to pick what to read — one matchup at a time.  
Each round, two books go head-to-head. The winner stays; a new challenger appears.  
After a few rounds, the books with the most wins rise to the top.

At the end, it’s pretty clear which one I actually _want_ to read... usually.

---

## How It Works

BookPickr lets you:

- Choose a starting set of books:
- From the **New York Times Top 100**, or
- By **genre** or **author**, using live data from the **Open Library API**
- Play matchups between two books at a time — “which one would I rather read?”
- Track your top picks as the app builds your personalized leaderboard
- Reset and start over whenever you want a fresh set of matchups

---

## Tech Stack

**Frontend**

- [React](https://react.dev) + [Vite](https://vitejs.dev)
- Whole lotta TypeScript for type safety
- Custom CSS for a clean, bookstore-inspired aesthetic

**APIs**

- [Open Library API](https://openlibrary.org/developers/api) — for fetching books, authors, and covers

**Deployment**

- Hosted on [Vercel](https://vercel.com)

---

## Running Locally

1. **Clone the repository**

   ```bash
   git clone https://github.com/ConnorMoss02/BookPickr.git
   cd BookPickr

   ```

2. Install dependencies:
   `npm install`

3. Start the development server:
   `npm run dev`

4. Open in your browser:
   `http://localhost:5173`

---

## Future Ideas

- User accounts to save matchups and leaderboards
- “Share your top picks” feature
- Integration with Goodreads or Libby
- Upload your own book lists
- Mood-based or time-based recommendations

---

## Inspiration

BookPickr was born out of curiosity and indecision.  
I love reading, but there's simply too many good books!

Now, the process feels like a _game_ — and it helps me uncover what I’m genuinely excited to read next.

---

**Built by [Connor Moss](https://github.com/ConnorMoss02)**
