"use client";

import { motion } from "motion/react";
import { ArrowDown, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

export function Hero() {
  return (
    <section className="mx-auto flex max-w-4xl flex-col items-center px-6 pt-28 pb-20 text-center sm:pt-36">
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex items-center gap-2 rounded-full glass px-4 py-1.5 text-sm font-medium"
      >
        <Sparkles className="size-4 text-primary" aria-hidden />
        Your personal operating system, powered by AI
      </motion.div>

      <motion.h1
        {...fadeUp}
        transition={{ duration: 0.5, delay: 0.08, ease: "easeOut" }}
        className="mt-8 text-5xl font-semibold tracking-tight text-balance sm:text-7xl"
      >
        One home for your whole&nbsp;life.
      </motion.h1>

      <motion.p
        {...fadeUp}
        transition={{ duration: 0.5, delay: 0.16, ease: "easeOut" }}
        className="mt-6 max-w-2xl text-lg text-pretty text-muted-foreground sm:text-xl"
      >
        Tasks, calendar, notes, documents, finance, habits and health — connected in one beautiful
        workspace, with an assistant that actually knows your day.
      </motion.p>

      <motion.div
        {...fadeUp}
        transition={{ duration: 0.5, delay: 0.24, ease: "easeOut" }}
        className="mt-10 flex flex-wrap items-center justify-center gap-3"
      >
        <Button size="lg" asChild>
          <a href="#modules">
            Explore the modules
            <ArrowDown aria-hidden />
          </a>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <a href="#assistant">Meet the assistant</a>
        </Button>
      </motion.div>
    </section>
  );
}
