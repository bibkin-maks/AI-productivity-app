import Reveal from '../home/Reveal';

const plans = [
    {
        title: "Starter",
        price: "$0",
        features: ["5 Documents / month", "Basic Chat functionality", "10MB File Limit", "Email Support"],
    },
    {
        title: "Pro",
        price: "$29",
        features: ["Unlimited Documents", "Advanced AI Models (GPT-4)", "100MB File Limit", "Priority Support", "Export to CSV/PDF"],
        isPopular: true,
    },
    {
        title: "Enterprise",
        price: "Custom",
        features: ["Dedicated Server", "Custom AI Fine-tuning", "SLA Guarantee", "24/7 Phone Support", "SSO Integration"],
    }
];

export default function Pricing({ onSelect }) {
    return (
        <section id="pricing" className="home-section" data-shape="planet" data-side="left" aria-labelledby="pricing-title">
            <div className="home-container">
                <div className="home-split home-split--end mb-24">
                    <div>
                        <h2 id="pricing-title" className="home-display home-h2">
                            <Reveal as="span" className="block home-outline">Simple, Transparent</Reveal>
                            <Reveal as="span" delay={0.1} className="block">Pricing</Reveal>
                        </h2>
                        <Reveal delay={0.2} as="p" className="home-lead mt-8">
                            <strong>No hidden fees. Cancel anytime.</strong> Choose the plan that fits your workflow.
                        </Reveal>
                    </div>
                </div>

                <div className="home-columns">
                    {plans.map((plan, i) => (
                        <Reveal key={plan.title} delay={0.1 * i} className="home-column flex flex-col">
                            <p className="home-label flex justify-between">
                                {plan.title}
                                {plan.isPopular && <span className="home-tag">Most Popular</span>}
                            </p>
                            <p className="mt-6 mb-8 flex items-baseline gap-2">
                                <span className="home-price">{plan.price}</span>
                                <span className="home-body">/mo</span>
                            </p>
                            <ul className="home-list flex-1 mb-10">
                                {plan.features.map((feat) => <li key={feat}>{feat}</li>)}
                            </ul>
                            <button
                                type="button"
                                onClick={onSelect}
                                className={`home-btn self-start ${plan.isPopular ? 'home-btn--solid' : 'home-btn--ghost'}`}
                            >
                                Get Started <span className="home-btn__arrow" aria-hidden="true">→</span>
                            </button>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}
