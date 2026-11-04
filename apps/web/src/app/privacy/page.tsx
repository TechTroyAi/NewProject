import Link from 'next/link'

export const dynamic = 'force-static'

/**
 * Privacy policy.
 *
 * Shelf is single-user by design: your shelf belongs to you and is not
 * shared with anybody else.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-[720px] px-5 py-10 sm:px-6">
      <h1 className="text-[26px] font-semibold tracking-[-.02em]">Privacy policy</h1>
      <p className="mt-2 text-[12.5px] text-faint">Last updated 4 November 2026</p>

      <div className="prose-shelf mt-7 space-y-5 text-[13.5px] leading-relaxed text-muted">
        <section>
          <h2 className="text-[15px] font-semibold text-fg">What is stored</h2>
          <p>
            The files you upload, the notes and cards you write, your reading progress, your quiz reviews and
            your settings. Each row is tied to your account, and Row Level Security in the database means a
            query can only ever return your own rows.
          </p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold text-fg">Who can see it</h2>
          <p>
            Nobody else. Shelf has no public sharing, no public profiles and no social graph. Files are served
            through short-lived signed URLs, and the download link for a page expires.
          </p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold text-fg">The assistant</h2>
          <p>
            When you ask a question, the relevant parts of your own notes and the pages you have already read
            are sent to the AI provider you configured — by default the Gemini API, using a key you supply.
            Text beyond the pages you have read is filtered out in the database before retrieval, so the model
            cannot spoil the next chapter. If you bring your own key, it is read from the environment and never
            sent to the browser.
          </p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold text-fg">Analytics</h2>
          <p>
            There is no third-party analytics, no advertising and no tracking pixel. The only measurement is
            the activity table inside your own database, which draws the heatmap on your dashboard.
          </p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold text-fg">Local drafts</h2>
          <p>
            Unsent edits are kept in your browser&rsquo;s IndexedDB so a dropped connection does not lose a
            keystroke. They are yours, they stay on your device, and they are removed once the note saves.
          </p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold text-fg">Deleting your data</h2>
          <p>
            Settings → Data → Delete account removes every file, note, card and review, and deletes your
            account. You can export everything first as markdown or JSON.
          </p>
        </section>
      </div>

      <p className="mt-8 text-[12.5px] text-faint">
        See also the{' '}
        <Link href="/terms" className="text-accent hover:underline">
          terms of service
        </Link>
        .
      </p>
    </main>
  )
}
