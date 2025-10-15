export type Book =
{
    id: number;
    title: string;
    author: string;
};

export type SourceBook = Book & {
  workKey?: string;   
  coverId?: number;  
  year?: number;
};