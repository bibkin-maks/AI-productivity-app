import React from 'react';
import Reveal from '../home/Reveal';

const features = [
    {
        title: "Universal Upload",
        description: "Drag & drop PDFs, Word docs, or text files. We handle parsing efficiently so you can focus on insights.",
    },
    {
        title: "AI Analysis",
        description: "Our advanced models read and understand your documents instantly, extracting key data points and summaries.",
    },
    {
        title: "Natural Chat",
        description: "Ask questions in plain English. Get answers powered by context-aware AI that cites strictly from your files.",
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
                            Transform your static documents into <strong>interactive knowledge bases</strong> in seconds.
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
