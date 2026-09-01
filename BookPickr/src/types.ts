export type Book = {
  id: number;
  title: string;
  author: string;

  // Resolved Open Library identifiers. When present the app can build a cover
  // URL and fetch a synopsis directly, with no search.json round trip.
  workKey?: string;
  coverId?: number;
};

export type SourceBook = Book & {
  year?: number;
};
