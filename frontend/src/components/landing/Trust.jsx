import { useId, useState } from 'react';
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
    // Only what the code actually does — see backend/app/core/security.py and the tests
    const badges = [
        { title: "No passwords", text: "You sign in with Google. Sessions use tokens signed with a key unique to you, and signing out revokes every one of them." },
        { title: "Your data stays yours", text: "Every request is scoped to your account, and automated tests check that nobody can read or change another person's notes, events or documents." },
        { title: "Encrypted in transit", text: "Connections to the app and to the database use TLS. Uploaded PDFs are read in memory; only their text passages are kept." },
    ];
    const faqs = [
        { question: "Where does my data go?", answer: "Notes, events and document passages are stored in MongoDB. To answer a question, the relevant passages and your question are sent to OpenAI, whose API doesn't train on this data by default." },
        { question: "What can I upload?", answer: "PDFs of up to 20 MB and 100 pages. Other formats, and several documents at once, are on the roadmap." },
        { question: "Does it cost anything?", answer: "No. ChatDoc is a personal project: free to use while it's online, and open source so you can run your own copy." },
    ];

    return (
        <section id="security" className="home-section" data-shape="shield" data-side="right" aria-labelledby="security-title">
            <div className="home-container">
                <div className="max-w-4xl">
                    <h2 id="security-title" className="home-display home-h2">
                        <Reveal as="span" className="block home-outline">Security,</Reveal>
                        <Reveal as="span" delay={0.1} className="block">plainly</Reveal>
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
