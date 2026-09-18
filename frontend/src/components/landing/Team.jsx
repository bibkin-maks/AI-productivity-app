import { Fragment } from 'react';
import { Github } from 'lucide-react';
import Reveal from '../home/Reveal';
import { REPO_URL } from './OpenSource';

// What the app is made of, and what each piece does in it
const stack = [
    { name: "React", role: "Interface" },
    { name: "FastAPI", role: "API" },
    { name: "MongoDB", role: "Data" },
    { name: "OpenAI", role: "Answers" },
    { name: "Three.js", role: "Particles" },
    { name: "Docker", role: "Shipping" },
];

function StackRow({ offset, reverse }) {
    const row = [...stack.slice(offset), ...stack.slice(0, offset)];
    return (
        <div className={`home-marquee ${reverse ? 'home-marquee--reverse' : ''}`}>
            <div className="home-marquee__track">
                {[0, 1].map((half) => (
                    <div key={half} className="flex items-center" aria-hidden={half === 1 || undefined}>
                        {row.map((item, i) => (
                            <Fragment key={item.name}>
                                <div className="home-person">
                                    <span className={`home-marquee__item !pr-0 ${(i + offset) % 2 ? 'home-outline' : ''}`}>{item.name}</span>
                                    <span className="home-person__role">{item.role}</span>
                                </div>
                                <span className="home-marquee__dot mx-10 !w-3 !h-3 self-start mt-[0.6em]" aria-hidden="true" />
                            </Fragment>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function Team() {
    return (
        <section id="built-by" className="home-section !block" data-shape="cat" data-side="right" aria-labelledby="built-by-title">
            <div className="home-container mb-20">
                <h2 id="built-by-title" className="home-display home-h2">
                    <Reveal as="span" className="block home-outline">Built by</Reveal>
                    <Reveal as="span" delay={0.1} className="block">one person</Reveal>
                </h2>
                <Reveal delay={0.2} as="p" className="home-lead mt-8 max-w-2xl">
                    Designed and engineered by <strong>bibkin-maks</strong>, from the particle shaders to the database migrations.
                </Reveal>
                <Reveal delay={0.3} className="mt-10">
                    <a href={REPO_URL} target="_blank" rel="noreferrer" className="home-btn home-btn--ghost">
                        <Github size={18} aria-hidden="true" /> Source on GitHub
                    </a>
                </Reveal>
            </div>

            {/* First row carries the accessible content; the reversed row is visual only */}
            <StackRow offset={0} />
            <div aria-hidden="true">
                <StackRow offset={3} reverse />
            </div>
        </section>
    );
}
