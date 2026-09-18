import { motion } from "framer-motion";

// Fade + rise once when scrolled into view. MotionConfig reducedMotion="user" on the page
// turns the movement off for people who ask for less motion.
export default function Reveal({ as = "div", delay = 0, className = "", children, ...rest }) {
  const Component = motion[as] || motion.div;
  return (
    <Component
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
      {...rest}
    >
      {children}
    </Component>
  );
}
