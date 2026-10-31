"use client";

import { useState } from "react";
import Image from "next/image";

/* ── A YouTube embed that costs nothing until somebody presses play ──────────────────────────────
 *
 * ⚠️ A FACADE, NOT AN `<iframe>`. Dropping YouTube's player straight into the page pulls well over a
 * megabyte of their JavaScript and sets cookies on EVERY visit, whether or not anyone watches — on
 * the one page whose whole job is to load fast for a stranger on a phone. So the resting state is a
 * poster and a button, and the iframe is mounted on the click that asks for it.
 *
 * ⚠️ AND THE POSTER IS OURS, SERVED FROM `/public`. YouTube's own thumbnail host would work and is
 * the obvious shortcut — it also means a request to Google, with the visitor's IP, before they have
 * asked for anything. That is the exact disclosure SEC-WEB-7 removed Google Fonts over, and it would
 * have put a second origin in `img-src` to do it. A 64KB JPEG next to the logo costs one build-time
 * download and leaks nothing.
 *
 * ⚠️ `youtube-nocookie.com`, not `youtube.com` — their privacy-enhanced host, which holds off on
 * cookies until playback. By then the visitor has chosen it. It is also the ONE origin this adds to
 * the CSP (`shared/securityHeaders.mjs`), so keep the two in step: change the host here and the
 * frame stops loading, silently, the day CSP_ENFORCE is on.
 *
 * ⚠️ A <button>, NOT A DIV WITH AN onClick. It gets keyboard focus, Enter and Space for free, and a
 * screen reader announces it — the same rule the designer's NavRow exists for.
 */
export default function VideoEmbed({
  videoId,
  poster,
  title,
  caption,
}: {
  videoId: string;
  poster: string;
  title: string;
  caption?: string;
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <figure className="max-w-4xl mx-auto">
      {/* 16:9, reserved before anything loads — the poster and the iframe are the same shape, so
          pressing play does not reflow the page under the reader's thumb. */}
      <div className="relative w-full aspect-video overflow-hidden rounded-xl border border-[#6b8f7e]/20 bg-[#0d0d0d] shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
        {playing ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            /* `autoplay=1` because the click already was the consent; `playsinline=1` so iOS does
               not take the video full-screen and throw the page away behind it. */
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play the video: ${title}`}
            className="group absolute inset-0 h-full w-full cursor-pointer"
          >
            <Image
              src={poster}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 896px"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
            {/* A wash under the button, so the play mark holds its contrast whatever frame the
                poster happens to be. Deepens on hover rather than appearing — hover is feedback on
                top of a control that already reads as pressable, never the thing that makes it
                legible (root CLAUDE.md rule 7). */}
            <span className="absolute inset-0 bg-[#0d0d0d]/25 transition-colors duration-300 group-hover:bg-[#0d0d0d]/40" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#edeae3] shadow-[0_6px_24px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-110 md:h-24 md:w-24">
                {/* A triangle, drawn rather than an emoji — there are no pictographic emoji in any
                    Spattoo UI. Nudged right by a hair because a triangle's optical centre is not
                    its bounding box. */}
                <svg viewBox="0 0 24 24" aria-hidden="true" className="ml-1 h-8 w-8 fill-[#3d5247] md:h-10 md:w-10">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </span>
          </button>
        )}
      </div>

      {caption && (
        <figcaption className="mt-4 text-center text-sm text-[#edeae3]/50">{caption}</figcaption>
      )}
    </figure>
  );
}
