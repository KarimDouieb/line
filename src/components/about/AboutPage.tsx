import { SocialIcon } from "@/components/about/SocialIcon";

const SOCIALS = [
  { label: "Instagram", href: "https://www.instagram.com/karim_douieb/", icon: "instagram" },
  { label: "X", href: "https://x.com/karim_douieb", icon: "x" },
  { label: "Bluesky", href: "https://bsky.app/profile/karimdouieb.bsky.social", icon: "bluesky" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/karim-douieb/", icon: "linkedin" },
] as const;

export function AboutPage() {
  return (
    <div className="mx-auto mt-16 max-w-[560px] px-6 pb-24">
      <div className="mb-12 flex items-center gap-3">
        <span className="font-serif text-[44px] font-medium leading-none text-foreground">Line</span>
        <span className="font-serif text-4xl leading-none text-foreground/45">線</span>
        <span className="h-[3px] w-6 rounded-full bg-accent" />
      </div>

      <div className="space-y-5 font-serif text-[19px] leading-[1.7] text-foreground/90">
        <p>
          potters don't design bowls and vases, they design one curve. That single line, rotated
          around the axis, becomes the entire form.
        </p>
        <p>
          In Line, you draw that curve. One side, shaped with a handful of control points, and the
          app grows a family of proportions around it: each variant keeping the radii and angles
          that make your line recognizably yours. Taller, wider, slender, grand: different vessels,
          same gesture.
        </p>
        <p className="text-foreground">Find the line. The rest is proportion.</p>
      </div>

      <div className="my-14 h-px w-full bg-[repeating-linear-gradient(90deg,rgba(60,50,35,.28)_0,rgba(60,50,35,.28)_1px,transparent_1px,transparent_8px)]" />

      <div className="font-sans">
        <h2 className="mb-3 font-serif text-lg text-foreground">Karim Douieb</h2>
        <p className="max-w-[46ch] text-[13.5px] leading-relaxed text-foreground/70">
          Data scientist, coder, and co-founder of{" "}
          <a
            href="https://jetpack.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/80 underline decoration-border underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
          >
            Jetpack.AI
          </a>
          . I spend my days making sense of the world through data visualization, and my evenings at
          the wheel making sense of clay. Line lives where those two habits meet.
        </p>

        <p className="mt-6 mb-3 text-[10px] tracking-[0.14em] text-muted-foreground">
          IF YOU LIKE LINE, COME SAY HI
        </p>
        <ul className="-ml-2 flex items-center gap-1">
          {SOCIALS.map((s) => (
            <li key={s.label}>
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                title={s.label}
                aria-label={s.label}
                className="flex size-9 items-center justify-center rounded-full text-foreground/65 transition-colors hover:bg-foreground/[0.07] hover:text-accent"
              >
                <SocialIcon name={s.icon} className="size-[18px]" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
