// Adapted from MicroKit Sliding Content Tabs: https://microkit.co/components/sliding-content-tabs
// Controlled state connects navigation to the real application views.
import { motion } from "motion/react";
export function ActionTabs({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      className="action-tabs"
      role="tablist"
      aria-label="Navegação da operação"
    >
      {items.map((item, index) => (
        <button
          type="button"
          key={item.id}
          role="tab"
          aria-selected={value === item.id}
          tabIndex={value === item.id ? 0 : -1}
          onClick={() => onChange(item.id)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              const next =
                (index + (e.key === "ArrowRight" ? 1 : -1) + items.length) %
                items.length;
              onChange(items[next].id);
              (
                e.currentTarget.parentElement?.children[next] as HTMLElement
              ).focus();
            }
          }}
        >
          {item.label}
          {value === item.id && (
            <motion.span
              layoutId="microkit-active-tab"
              className="tab-underline"
              transition={{ duration: 0.18 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
