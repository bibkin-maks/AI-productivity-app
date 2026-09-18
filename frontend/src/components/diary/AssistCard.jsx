import { Link } from "react-router-dom";
import { Sparkles, Loader } from "lucide-react";

export default function AssistCard({ remaining }) {
  return (
    <section className="assist-card" aria-labelledby="assist-title">
      <h2 id="assist-title" className="text-[34px] font-semibold leading-[1.05] tracking-tight">
        <span className="text-white/55">Plan</span>
        <br />
        your day with Purr...
      </h2>
      <div className="assist-orb" aria-hidden="true">
        <span className="assist-orb__inner" />
        <span className="assist-orb__glyph"><Sparkles size={34} strokeWidth={1.6} /></span>
      </div>
      <Link to="/purr-assist" className="assist-pill">
        <Loader size={16} aria-hidden="true" /> Open Purr Assist
      </Link>
      <p className="text-white/60 text-sm mt-5">
        {remaining
          ? `${remaining} thing${remaining === 1 ? "" : "s"} left today. Ask what to tackle first.`
          : "Everything's done. Ask Purr to plan tomorrow."}
      </p>
    </section>
  );
}
