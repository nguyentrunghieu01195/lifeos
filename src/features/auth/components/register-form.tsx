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

import { registerSchema, type RegisterInput } from "../schemas";
import { registerAction } from "../server/actions";
import { initialAuthFormState, type AuthField } from "../types";

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialAuthFormState);
  const [isPending, startTransition] = useTransition();

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  useEffect(() => {
    if (state.status !== "error" || !state.fieldErrors) return;
    for (const [field, message] of Object.entries(state.fieldErrors)) {
      if (message && (field === "name" || field === "email" || field === "password")) {
        form.setError(field as AuthField, { type: "server", message });
      }
    }
  }, [state, form]);

  const onSubmit = form.handleSubmit((values) => {
    const formData = new FormData();
    formData.set("name", values.name);
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input autoComplete="name" placeholder="Your name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Create account
        </Button>
      </form>
    </Form>
  );
}
