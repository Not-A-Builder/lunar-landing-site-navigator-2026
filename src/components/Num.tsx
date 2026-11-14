import { Fragment } from "react";

const NUM = /([+\-−]?\d[\d.,:]*(?:\s?(?:°|%))?)/g;

/**
 * Renders text with every numeric run (12, −0.47°, 31%, 2027-01-10 00:00) in IBM Plex Mono, so numbers
 * read consistently inside sentences and labels.
 */
export function NumText({ children }: { children: string }) {
  const parts = children.split(NUM);
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <span key={i} className="num">{p}</span> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}
