import Reveal from '../home/Reveal';

export const REPO_URL = "https://github.com/bibkin-maks/AI-productivity-app";

const ways = [
    {
        title: "Use it",
        big: "Free",
        points: ["Sign in with Google", "Chat, notes, calendar, diary and voice", "PDFs up to 20 MB"],
        cta: "Sign in",
        primary: true,
    },
    {
        title: "Run it yourself",
        big: "Docker",
        points: ["One command: docker compose up", "Your own OpenAI key and MongoDB", "Local neural voices included"],
        cta: "Setup guide",
        href: `${REPO_URL}#run-it-locally`,
    },
    {
        title: "Read the code",
        big: "MIT",
        points: ["React and FastAPI", "Tested, with CI on every push", "Even the promo video is code"],
        cta: "View on GitHub",
        href: REPO_URL,
    },
];

export default function OpenSource({ onSelect }) {
    return (
        <section id="open-source" className="home-section" data-shape="planet" data-side="left" aria-labelledby="open-source-title">
            <div className="home-container">
                <div className="home-split home-split--end mb-24">
                    <div>
                        <h2 id="open-source-title" className="home-display home-h2">
                            <Reveal as="span" className="block home-outline">Free, and</Reveal>
                            <Reveal as="span" delay={0.1} className="block">open source</Reveal>
                        </h2>
                        <Reveal delay={0.2} as="p" className="home-lead mt-8">
                            <strong>No plans, no card.</strong> Use it here, or run your own copy with one command.
                        </Reveal>
                    </div>
                </div>

                <div className="home-columns">
                    {ways.map((way, i) => (
                        <Reveal key={way.title} delay={0.1 * i} className="home-column flex flex-col">
                            <p className="home-label">{way.title}</p>
                            <p className="home-price mt-6 mb-8">{way.big}</p>
                            <ul className="home-list flex-1 mb-10">
                                {way.points.map((point) => <li key={point}>{point}</li>)}
                            </ul>
                            {way.href ? (
                                <a href={way.href} target="_blank" rel="noreferrer" className="home-btn home-btn--ghost self-start">
                                    {way.cta} <span className="home-btn__arrow" aria-hidden="true">→</span>
                                </a>
                            ) : (
                                <button type="button" onClick={onSelect} className="home-btn home-btn--solid self-start">
                                    {way.cta} <span className="home-btn__arrow" aria-hidden="true">→</span>
                                </button>
                            )}
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}
