import React from 'react';
import { Github, Twitter, Linkedin } from 'lucide-react';
import Reveal from '../home/Reveal';

const members = [
    { name: "Max Kodak", role: "AI Research Lead" },
    { name: "Sarah Connor", role: "Chief Security Officer" },
    { name: "Neo Anderson", role: "Frontend Architect" },
    { name: "Trinity Moss", role: "Product Strategy" },
];

const TeamMember = ({ name, role, outlined, decorative }) => (
    <div className="home-person">
        <span className={`home-marquee__item !pr-0 ${outlined ? 'home-outline' : ''}`}>{name}</span>
        <span className="flex items-center gap-4">
            <span className="home-person__role">{role}</span>
            {!decorative && (
                <span className="home-socials">
                    <a href="#team" aria-label={`${name} on GitHub`}><Github size={18} /></a>
                    <a href="#team" aria-label={`${name} on Twitter`}><Twitter size={18} /></a>
                    <a href="#team" aria-label={`${name} on LinkedIn`}><Linkedin size={18} /></a>
                </span>
            )}
        </span>
    </div>
);

function NameRow({ offset, reverse, decorativeOnly = false }) {
    const row = [...members.slice(offset), ...members.slice(0, offset)];
    return (
        <div className={`home-marquee ${reverse ? 'home-marquee--reverse' : ''}`}>
            <div className="home-marquee__track">
                {[0, 1].map((half) => (
                    <div key={half} className="flex items-center" aria-hidden={half === 1 || undefined}>
                        {row.map((m, i) => (
                            <React.Fragment key={m.name}>
                                <TeamMember {...m} outlined={(i + offset) % 2 === 1} decorative={decorativeOnly || half === 1} />
                                <span className="home-marquee__dot mx-10 !w-3 !h-3 self-start mt-[0.6em]" aria-hidden="true" />
                            </React.Fragment>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function Team() {
    return (
        <section id="team" className="home-section !block" data-shape="cat" data-side="right" aria-labelledby="team-title">
            <div className="home-container mb-20">
                <h2 id="team-title" className="home-display home-h2">
                    <Reveal as="span" className="block home-outline">Meet the</Reveal>
                    <Reveal as="span" delay={0.1} className="block">Visionaries</Reveal>
                </h2>
                <Reveal delay={0.2} as="p" className="home-lead mt-8 max-w-2xl">
                    Building the future of <strong>document intelligence</strong>, one node at a time.
                </Reveal>
            </div>

            {/* First row carries the accessible content; the reversed row is visual only */}
            <NameRow offset={0} />
            <div aria-hidden="true">
                <NameRow offset={2} reverse decorativeOnly />
            </div>
        </section>
    );
}
