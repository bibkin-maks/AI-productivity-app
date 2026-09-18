import Reveal from '../home/Reveal';

const features = [
    {
        title: "Upload a PDF",
        description: "Drop in a PDF of up to 20 MB. It's read in memory, split into passages and indexed once, so questions stay fast.",
    },
    {
        title: "Ask anything",
        description: "Ask in plain language. Answers draw on the most relevant passages of your document, and the assistant remembers the conversation.",
    },
    {
        title: "Plan your days",
        description: "Keep notes and a calendar next to your documents, see today at a glance, or just talk to Purr, the voice assistant.",
    }
];

function Marquee() {
    // Two identical halves so translateX(-50%) loops seamlessly
    const items = [...features, ...features];
    return (
        <div className="home-marquee" aria-hidden="true">
            <div className="home-marquee__track">
                {[0, 1].map((half) => (
                    <div key={half} className="flex">
                        {items.map((f, i) => (
                            <span key={i} className="home-marquee__item">
                                <span className={i % 2 === 0 ? '' : 'home-outline'}>{f.title}</span>
                                <span className="home-marquee__dot" />
                            </span>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function Features() {
    return (
        <section id="how" className="home-section !block" data-shape="bubble" data-side="left" aria-labelledby="how-title">
            <div className="home-container">
                <div className="home-split home-split--end">
                    <div>
                        <h2 id="how-title" className="home-display home-h2">
                            <Reveal as="span" className="block home-outline">How ChatDoc</Reveal>
                            <Reveal as="span" delay={0.1} className="block">Works</Reveal>
                        </h2>
                        <Reveal delay={0.2} as="p" className="home-lead mt-8">
                            From a PDF to <strong>answers in seconds</strong>, with your notes and plans right beside them.
                        </Reveal>
                    </div>
                </div>
            </div>

            <div className="my-24 lg:my-32">
                <Marquee />
            </div>

            <div className="home-container">
                <div className="home-columns">
                    {features.map((f, i) => (
                        <Reveal key={f.title} delay={0.1 * i} className="home-column">
                            <p className="home-label">{String(i + 1).padStart(2, '0')}</p>
                            <h3 className="home-column__title">{f.title}</h3>
                            <p className="home-body">{f.description}</p>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}
