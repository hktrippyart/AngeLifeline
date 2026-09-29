"use client";

import {
  getAngeLifelineEmbedDisclaimer,
  type AngeLifelineEmbedDisclaimer,
} from "@angelifeline/core";
import type { UiLocale } from "@angelifeline/core";

type Props = {
  uiLocale: UiLocale;
  className?: string;
  compact?: boolean;
};

/** Default embed scope copy from `@angelifeline/core`. */
export function AngeLifelineEmbedDisclaimer({
  uiLocale,
  className = "",
  compact = false,
}: Props) {
  const d = getAngeLifelineEmbedDisclaimer(uiLocale);

  if (compact) {
    const text = [d.paragraphs[0], d.paragraphs[1]].join(" ");
    return (
      <div
        className={`rounded-2xl border border-line bg-deep/80 px-4 py-3 text-sm leading-relaxed text-mist ${className}`.trim()}
        role="note"
        aria-label={d.title}
      >
        <p className="font-medium text-fog">{d.title}</p>
        <p className="mt-2">{text}</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-line bg-deep/80 px-4 py-3 text-sm leading-relaxed text-mist ${className}`.trim()}
      role="note"
      aria-labelledby="angelifeline-embed-disclaimer-title"
    >
      <p
        id="angelifeline-embed-disclaimer-title"
        className="font-medium text-fog"
      >
        {d.title}
      </p>
      <ul className="mt-2 list-disc space-y-2 pl-5">
        {d.paragraphs.map((p) => (
          <li key={p.slice(0, 48)}>{p}</li>
        ))}
      </ul>
    </div>
  );
}

export type { AngeLifelineEmbedDisclaimer };
