// Adapted from https://microkit.co/components/secure-purchase-button
// Real API state replaces demo timers; success never precedes persistence.
import { Check, LoaderCircle } from "lucide-react";
import { Button, type ButtonProps } from "../ui/button";
export function ActionButton({
  pending = false,
  success = false,
  children,
  ...props
}: ButtonProps & { pending?: boolean; success?: boolean }) {
  return (
    <Button
      {...props}
      disabled={props.disabled || pending}
      aria-busy={pending}
      data-state={pending ? "processing" : success ? "success" : "idle"}
    >
      <span aria-live="polite" className="flex gap-2 items-center">
        {pending ? (
          <LoaderCircle size={14} className="animate-spin" />
        ) : success ? (
          <Check size={14} />
        ) : null}
        {children}
      </span>
    </Button>
  );
}
