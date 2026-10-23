// Page references are generated, never typed by hand (12-pdf-roadmap §1.1).
export interface BookRef {
  book: 'Gram' | 'Coll';
  unit: number;
}

/** Gram unit n → book page 2n, PDF 2n+12. Coll unit n → book page 2n+4, PDF 2n+8. */
export function formatBookRef({ book, unit }: BookRef): string {
  return book === 'Gram'
    ? `Gram ünite ${unit} · k.${2 * unit} · PDF ${2 * unit + 12}`
    : `Coll ünite ${unit} · k.${2 * unit + 4} · PDF ${2 * unit + 8}`;
}
