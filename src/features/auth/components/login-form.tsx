"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useActionState, useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { loginSchema, type LoginInput } from "../schemas";
import { loginAction } from "../server/actions";
import { initialAuthFormState, type AuthField } from "../types";

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialAuthFormState);
  const [isPending, startTransition] = useTransition();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Surface server-side field errors on the matching inputs.
  useEffect(() => {
    if (state.status !== "error" || !state.fieldErrors) return;
    for (const [field, message] of Object.entries(state.fieldErrors)) {
      if (message && (field === "email" || field === "password")) {
        form.setError(field as Extract<AuthField, "email" | "password">, {
          type: "server",
          message,
        });
      }
    }
  }, [state, form]);

  const onSubmit = form.handleSubmit((values) => {
    const formData = new FormData();
    formData.set("email", values.email);
    formData.set("password", values.password);
    startTransition(() => formAction(formData));
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {state.status === "error" && state.formError ? (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {state.formError}
          </p>
        ) : null}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Sign in
        </Button>
      </form>
    </Form>
  );
}
