"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { type LoginState, requestCode, verifyCode } from "@/app/connexion/actions";
import { FieldError, Label } from "./Field";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-ink w-full" disabled={pending}>
      {pending ? "Un instant…" : label}
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<LoginState, FormData>(requestCode, { step: "email" });

  if (state.step === "code" && state.email) {
    return <CodeForm email={state.email} next={next} />;
  }

  return (
    <form action={action} className="space-y-6">
      <div>
        <Label htmlFor="email">Ton adresse e-mail</Label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          placeholder="camille@exemple.fr"
          className="field mt-1 text-lg"
        />
        <FieldError message={state.error} />
      </div>
      <Submit label="Recevoir mon code" />
      <p className="text-ink-faint text-sm text-pretty">
        On t&apos;envoie un code à six chiffres. Pas de mot de passe à retenir, et
        ton adresse sert uniquement à retrouver tes réponses d&apos;un appareil à
        l&apos;autre.
      </p>
    </form>
  );
}

function CodeForm({ email, next }: { email: string; next: string }) {
  const [state, action] = useActionState<LoginState, FormData>(verifyCode, {
    step: "code",
    email,
  });

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="next" value={next} />

      <div>
        <Label htmlFor="code" hint={email}>
          Ton code
        </Label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          maxLength={6}
          autoFocus
          placeholder="123456"
          className="field mt-1 text-center font-mono text-3xl tracking-[0.4em]"
        />
        <FieldError message={state.error} />
      </div>

      <Submit label="Me connecter" />

      <p className="text-ink-faint text-sm">
        Rien reçu ? Vérifie tes indésirables, ou{" "}
        <a href="/connexion" className="hover:text-vermilion underline underline-offset-4">
          recommence avec une autre adresse
        </a>
        .
      </p>
    </form>
  );
}
