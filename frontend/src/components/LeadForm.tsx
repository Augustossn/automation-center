import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "./ui/button";
export const leadSchema = z.object({
  name: z.string().trim().min(2, "Informe pelo menos 2 caracteres"),
  email: z.union([z.string().email("E-mail inválido"), z.literal("")]),
  phone: z.string(),
  channel: z.string().min(1, "Selecione um canal"),
  content: z
    .string()
    .trim()
    .min(5, "Descreva a solicitação (mínimo 5 caracteres)")
    .max(10000),
});
type Input = z.infer<typeof leadSchema>;
export function LeadForm({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const channels = useQuery({
    queryKey: ["channels"],
    queryFn: () => api<{ slug: string; name: string }[]>("/channels"),
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Input>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      channel: "website",
      content: "",
    },
  });
  const create = useMutation({
    mutationFn: (data: Input) =>
      api("/leads", {
        method: "POST",
        body: JSON.stringify({
          customer: { name: data.name, email: data.email, phone: data.phone },
          channel: data.channel,
          content: data.content,
        }),
      }),
    onSuccess: () => {
      client.invalidateQueries();
      toast.success("Lead criado e encaminhado para classificação");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="modal-backdrop">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-lead-title"
        className="modal"
      >
        <div className="flex justify-between items-center">
          <h2 id="new-lead-title">Novo lead</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Fechar">
            ×
          </Button>
        </div>
        <p>
          Centralize uma nova solicitação. A classificação acontece pela fila de
          eventos.
        </p>
        <form onSubmit={handleSubmit((d) => create.mutate(d))}>
          {(["name", "email", "phone"] as const).map((key, i) => (
            <label key={key}>
              {["Nome do cliente", "E-mail", "Telefone"][i]}
              <input {...register(key)} autoFocus={i === 0} />
              {errors[key] && (
                <small role="alert">{errors[key]?.message}</small>
              )}
            </label>
          ))}
          <label>
            Canal
            <select {...register("channel")}>
              {channels.data?.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Solicitação
            <textarea rows={4} {...register("content")} />
            {errors.content && (
              <small role="alert">{errors.content.message}</small>
            )}
          </label>
          <div className="flex justify-end gap-2 mt-5">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button disabled={create.isPending}>
              {create.isPending ? "Criando…" : "Criar lead"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
