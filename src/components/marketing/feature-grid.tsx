"use client";

import { motion } from "motion/react";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  FileText,
  Flame,
  HeartPulse,
  ShoppingCart,
  Sparkles,
  StickyNote,
  Wallet,
  type LucideIcon,
} from "lucide-react";

interface Module {
  icon: LucideIcon;
  name: string;
  description: string;
}

const MODULES: Module[] = [
  {
    icon: CheckCircle2,
    name: "Tasks",
    description: "Projects, priorities, subtasks and recurring work — in list, board or calendar.",
  },
  {
    icon: CalendarDays,
    name: "Calendar",
    description: "Day, week, month and agenda views with drag-and-drop scheduling.",
  },
  {
    icon: StickyNote,
    name: "Notes",
    description: "A rich editor with markdown, code blocks, tables and images.",
  },
  {
    icon: FileText,
    name: "Documents",
    description: "Upload PDFs, Word files and images — searchable and organized.",
  },
  {
    icon: Wallet,
    name: "Finance",
    description: "Income, expenses, budgets and saving goals with monthly reports.",
  },
  {
    icon: Flame,
    name: "Habits",
    description: "Daily and weekly tracking with streaks and a yearly heatmap.",
  },
  {
    icon: HeartPulse,
    name: "Health",
    description: "Weight, calories, water, sleep and workouts — charted over time.",
  },
  {
    icon: ShoppingCart,
    name: "Shopping",
    description: "Smart checklists with categories, prices and estimated totals.",
  },
  {
    icon: BookOpen,
    name: "Knowledge",
    description: "A personal knowledge base with linked notes and bookmarks.",
  },
  {
    icon: Sparkles,
    name: "AI Assistant",
    description: "Summarize your day, plan your week, analyze spending — grounded in your data.",
  },
];

export function FeatureGrid() {
  return (
    <section id="modules" className="mx-auto max-w-6xl scroll-mt-20 px-6 pb-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Everything in its place. Every place connected.
        </h2>
        <p className="mt-4 text-lg text-pretty text-muted-foreground" id="assistant">
          Ten modules that share one data layer — so your assistant can reason across your tasks,
          schedule, money and habits at once.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((module, index) => (
          <motion.article
            key={module.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, delay: (index % 3) * 0.07, ease: "easeOut" }}
            whileHover={{ y: -4 }}
            className="rounded-xl glass p-6"
          >
            <module.icon className="size-6 text-primary" aria-hidden />
            <h3 className="mt-4 font-semibold tracking-tight">{module.name}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {module.description}
            </p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
