import React, { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Reveal from '../home/Reveal';

const AccordionItem = ({ question, answer }) => {
    const [isOpen, setIsOpen] = useState(false);
    const panelId = useId();

    return (
        <div className="home-row">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="home-faq__question"
            >
                {question}
                <span className="home-faq__icon" aria-hidden="true" />
            </button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        id={panelId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                    >
                        <p className="home-body pb-8 max-w-2xl">{answer}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default function Trust() {
    const badges = [
        { title: "SOC 2 Compliant", text: "Our infrastructure adheres to the highest standards of data security and operational integrity." },
        { title: "End-to-End Encryption", text: "Your files are encrypted before they even leave your device." },
        { title: "99.9% Uptime SLA", text: "Reliability you can build your business on." },
    ];
    const faqs = [
        { question: "Is my data secure?", answer: "Absolutely. We use AES-256 encryption at rest and TLS 1.3 in transit. Your documents are processed in ephemeral containers and are never used to train our public models without explicit consent." },
        { question: "What file formats do you support?", answer: "Currently we support PDF, DOCX, TXT, MD, and CSV. We are actively working on adding support for Excel spreadsheets and PowerPoint presentations." },
        { question: "Can I cancel my subscription?", answer: "Yes, you can cancel anytime from your account settings. You will retain access until the end of your complete billing cycle." },
    ];

    return (
        <section id="security" className="home-section" data-shape="shield" data-side="right" aria-labelledby="security-title">
            <div className="home-container">
                <div className="max-w-4xl">
                    <h2 id="security-title" className="home-display home-h2">
                        <Reveal as="span" className="block home-outline">Enterprise-Grade</Reveal>
                        <Reveal as="span" delay={0.1} className="block">Security & Privacy</Reveal>
                    </h2>

                    <div className="mt-16">
                        {badges.map((b, i) => (
                            <Reveal key={b.title} delay={0.1 * i} className="home-row py-7 grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-8">
                                <h3 className="home-column__title !m-0">{b.title}</h3>
                                <p className="home-body">{b.text}</p>
                            </Reveal>
                        ))}
                    </div>

                    <Reveal as="h3" className="home-label mt-24 mb-4">Frequently Asked Questions</Reveal>
                    <Reveal delay={0.1}>
                        {faqs.map((faq) => (
                            <AccordionItem key={faq.question} {...faq} />
                        ))}
                    </Reveal>
                </div>
            </div>
        </section>
    );
}
