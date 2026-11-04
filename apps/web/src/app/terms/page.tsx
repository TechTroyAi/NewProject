import Link from 'next/link'

export const dynamic = 'force-static'

/**
 * Terms of service.
 *
 * Kept deliberately short and readable: Shelf stores whatever the user
 * drops into it, and the one thing that has to be clear is that the
 * user is responsible for what they upload.
 */
export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-[720px] px-5 py-10 sm:px-6">
      <h1 className="text-[26px] font-semibold tracking-[-.02em]">Terms of service</h1>
      <p className="mt-2 text-[12.5px] text-faint">Last updated 4 November 2026</p>

      <div className="prose-shelf mt-7 space-y-5 text-[13.5px] leading-relaxed text-muted">
        <section>
          <h2 className="text-[15px] font-semibold text-fg">Your content</h2>
          <p>
            You keep every right you already had in the files, notes and cards you put into Shelf. We claim no
            ownership over them. Upload only material you have the right to store — if a title is out of your
            hands, do not upload it.
          </p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold text-fg">Acceptable use</h2>
          <p>
            Shelf is a private reading and note-taking tool. Do not use it to store or distribute material that
            is unlawful in your jurisdiction, and do not use the assistant to circumvent the spoiler guard or
            another person&rsquo;s access controls.
          </p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold text-fg">The service</h2>
          <p>
            Shelf is provided as-is, with no guarantee of uptime. We may change or retire features. The
            assistant can be wrong — it is a language model reading your notes, not an authority on the books
            you are reading.
          </p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold text-fg">Deletion</h2>
          <p>
            You can delete your account at any time from Settings → Data. That removes your files, notes,
            cards and reviews. Exports taken before deletion remain yours.
          </p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold text-fg">Changes</h2>
          <p>
            If these terms change materially we will update the date above. Continuing to use Shelf after that
            means you accept the new version.
          </p>
        </section>
      </div>

      <p className="mt-8 text-[12.5px] text-faint">
        See also the{' '}
        <Link href="/privacy" className="text-accent hover:underline">
          privacy policy
        </Link>
        .
      </p>
    </main>
  )
}
