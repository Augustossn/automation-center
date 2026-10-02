/**
 * Card-stack pose adapted from Kokonut UI, Dorian Baffier, MIT.
 * https://github.com/kokonut-labs/kokonutui/blob/main/components/kokonutui/card-stack.tsx
 * Product images and hover fan-out removed for a functional queue empty state.
 */
import { motion, useReducedMotion } from "motion/react";
import { Inbox } from "lucide-react";
export function EmptyQueue() {
  const reduced = useReducedMotion();
  return (
    <div className="empty-queue">
      <div className="empty-card-stack" aria-hidden="true">
        {[2, 1, 0].map((index) => (
          <motion.div
            key={index}
            initial={false}
            animate={{
              x: index * 4,
              y: index * 2,
              rotate: reduced ? 0 : index * 1.5,
            }}
            transition={{ duration: 0.2 }}
            className="empty-card"
          >
            <Inbox size={18} />
          </motion.div>
        ))}
      </div>
      <p>Nenhuma tarefa nesta fila</p>
      <small>As próximas ações aparecerão aqui.</small>
    </div>
  );
}
