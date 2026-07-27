"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, Loader2, Pencil, Plus, Receipt, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { currentMonthKey, formatMoney, parseAmountInput, todayDateString } from "../lib/money";
import {
  aiCategorizeAction,
  applyCategoriesAction,
  createCategoryAction,
  createTransactionAction,
  deleteTransactionAction,
  updateTransactionAction,
} from "../server/actions";
import type {
  CategoryDto,
  CategorySuggestionDto,
  TransactionDto,
  TransactionTypeDto,
} from "../types";

const NONE = "__none__";
const NEW = "__new__";
const ALL = "__all__";

interface TransactionsTabProps {
  month: string;
  transactions: TransactionDto[];
  categories: CategoryDto[];
}

interface FormState {
  type: TransactionTypeDto;
  amount: string;
  note: string;
  date: string;
  categoryId: string;
}

export function TransactionsTab({ month, transactions, categories }: TransactionsTabProps) {
  // Viewing a past/future month: default new entries into THAT month so the
  // added row is visible where the user is looking.
  const defaultDate = month === currentMonthKey() ? todayDateString() : `${month}-01`;
  const [form, setForm] = useState<FormState>({
    type: "EXPENSE",
    amount: "",
    note: "",
    date: defaultDate,
    categoryId: NONE,
  });
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [editing, setEditing] = useState<TransactionDto | null>(null);
  const [deleting, setDeleting] = useState<TransactionDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [newCategoryFor, setNewCategoryFor] = useState<"form" | "edit" | null>(null);
  const [suggestions, setSuggestions] = useState<CategorySuggestionDto[] | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [aiBusy, setAiBusy] = useState(false);

  const formCategories = categories.filter((category) => category.type === form.type);
  const uncategorized = useMemo(
    () => transactions.filter((transaction) => transaction.category === null),
    [transactions],
  );

  const submitQuickAdd = async () => {
    const amountMinor = parseAmountInput(form.amount);
    if (amountMinor === null) {
      toast.error("Enter a valid amount (whole đồng).");
      return;
    }
    setAdding(true);
    const result = await createTransactionAction({
      type: form.type,
      amountMinor,
      note: form.note.trim(),
      date: form.date,
      categoryId: form.categoryId === NONE ? null : form.categoryId,
    });
    setAdding(false);
    if (result.ok) {
      setForm((state) => ({ ...state, amount: "", note: "" }));
    } else {
      toast.error(result.error);
    }
  };

  const submitDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    const result = await deleteTransactionAction(deleting.id);
    setBusy(false);
    if (result.ok) setDeleting(null);
    else toast.error(result.error);
  };

  const runAiCategorize = async () => {
    const ids = uncategorized.slice(0, 20).map((transaction) => transaction.id);
    if (ids.length === 0) return;
    setAiBusy(true);
    const result = await aiCategorizeAction({ transactionIds: ids });
    setAiBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSuggestions(result.data);
    setPicks(
      Object.fromEntries(
        result.data.map((entry) => [entry.transactionId, entry.categoryId ?? NONE]),
      ),
    );
  };

  const applySuggestions = async () => {
    if (!suggestions) return;
    const assignments = suggestions
      .map((entry) => ({
        transactionId: entry.transactionId,
        categoryId: picks[entry.transactionId],
      }))
      .filter((entry): entry is { transactionId: string; categoryId: string } =>
        Boolean(entry.categoryId && entry.categoryId !== NONE),
      );
    if (assignments.length === 0) {
      setSuggestions(null);
      return;
    }
    setAiBusy(true);
    const result = await applyCategoriesAction({ assignments });
    setAiBusy(false);
    if (result.ok) {
      toast.success(
        `Categorized ${result.data.applied} transaction${result.data.applied === 1 ? "" : "s"}.`,
      );
      setSuggestions(null);
    } else {
      toast.error(result.error);
    }
  };

  const term = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      transactions.filter((transaction) => {
        if (typeFilter !== ALL && transaction.type !== typeFilter) return false;
        if (categoryFilter !== ALL) {
          if (categoryFilter === NONE && transaction.category !== null) return false;
          if (categoryFilter !== NONE && transaction.category?.id !== categoryFilter) return false;
        }
        return !term || transaction.note.toLowerCase().includes(term);
      }),
    [transactions, typeFilter, categoryFilter, term],
  );

  const columns = useMemo<ColumnDef<TransactionDto>[]>(
    () => [
      {
        accessorKey: "date",
        header: ({ column }) => (
          <SortButton
            label="Date"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => <span className="tabular-nums">{row.original.date}</span>,
      },
      {
        accessorKey: "note",
        header: () => "Note",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate">
              {row.original.note || <span className="text-muted-foreground">—</span>}
            </span>
            {row.original.category ? (
              <Badge variant="outline" className="shrink-0 gap-1 text-[10px] font-normal">
                <span aria-hidden>{row.original.category.icon}</span>
                {row.original.category.name}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="shrink-0 text-[10px] font-normal text-muted-foreground"
              >
                Uncategorized
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: "amountMinor",
        header: ({ column }) => (
          <div className="text-right">
            <SortButton
              label="Amount"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            />
          </div>
        ),
        cell: ({ row }) => (
          <span
            className={cn(
              "block text-right font-mono text-sm tabular-nums",
              row.original.type === "EXPENSE"
                ? "text-destructive"
                : "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {row.original.type === "EXPENSE" ? "−" : "+"}
            {formatMoney(row.original.amountMinor)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={`Edit transaction ${row.original.note || row.original.date}`}
              onClick={() => setEditing(row.original)}
            >
              <Pencil aria-hidden className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-destructive hover:text-destructive"
              aria-label={`Delete transaction ${row.original.note || row.original.date}`}
              onClick={() => setDeleting(row.original)}
            >
              <Trash2 aria-hidden className="size-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: visible,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Quick add */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border glass p-3">
        <div className="flex rounded-lg border p-0.5" role="group" aria-label="Transaction type">
          {(["EXPENSE", "INCOME"] as const).map((type) => (
            <Button
              key={type}
              type="button"
              variant={form.type === type ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              aria-pressed={form.type === type}
              onClick={() => setForm((state) => ({ ...state, type, categoryId: NONE }))}
            >
              {type === "EXPENSE" ? "Expense" : "Income"}
            </Button>
          ))}
        </div>
        <div className="min-w-32 flex-1">
          <Label htmlFor="qa-amount" className="mb-1 block text-xs text-muted-foreground">
            Amount (₫)
          </Label>
          <Input
            id="qa-amount"
            inputMode="numeric"
            placeholder="1.500.000"
            value={form.amount}
            onChange={(event) => setForm((state) => ({ ...state, amount: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submitQuickAdd();
            }}
            className="h-9"
          />
        </div>
        <div className="min-w-40 flex-[2]">
          <Label htmlFor="qa-note" className="mb-1 block text-xs text-muted-foreground">
            Note
          </Label>
          <Input
            id="qa-note"
            placeholder="What was it for?"
            value={form.note}
            maxLength={200}
            onChange={(event) => setForm((state) => ({ ...state, note: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submitQuickAdd();
            }}
            className="h-9"
          />
        </div>
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">Category</Label>
          <Select
            value={form.categoryId}
            onValueChange={(value) => {
              if (value === NEW) {
                setNewCategoryFor("form");
                return;
              }
              setForm((state) => ({ ...state, categoryId: value }));
            }}
          >
            <SelectTrigger size="sm" className="w-40" aria-label="Category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No category</SelectItem>
              {formCategories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </SelectItem>
              ))}
              <SelectItem value={NEW}>+ New category…</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="qa-date" className="mb-1 block text-xs text-muted-foreground">
            Date
          </Label>
          <Input
            id="qa-date"
            type="date"
            value={form.date}
            onChange={(event) => setForm((state) => ({ ...state, date: event.target.value }))}
            className="h-9 w-38"
          />
        </div>
        <Button onClick={() => void submitQuickAdd()} disabled={adding} className="h-9">
          {adding ? <Loader2 aria-hidden className="animate-spin" /> : <Plus aria-hidden />}
          Add
        </Button>
      </div>

      {/* Filters + AI */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search notes…"
          aria-label="Search transactions"
          className="h-8 max-w-56"
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger size="sm" className="w-32" aria-label="Filter by type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            <SelectItem value="EXPENSE">Expenses</SelectItem>
            <SelectItem value="INCOME">Income</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger size="sm" className="w-44" aria-label="Filter by category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            <SelectItem value={NONE}>Uncategorized</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.icon} {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {uncategorized.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => void runAiCategorize()}
            disabled={aiBusy}
          >
            {aiBusy ? <Loader2 aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
            AI categorize ({Math.min(uncategorized.length, 20)})
          </Button>
        ) : null}
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          <Receipt aria-hidden className="size-6" />
          {transactions.length === 0
            ? "No transactions this month — add one above."
            : "Nothing matches this filter."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <EditTransactionDialog
        transaction={editing}
        categories={categories}
        onClose={() => setEditing(null)}
        onNewCategory={() => setNewCategoryFor("edit")}
      />

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete transaction?</DialogTitle>
            <DialogDescription>
              {deleting
                ? `${deleting.type === "EXPENSE" ? "−" : "+"}${formatMoney(deleting.amountMinor)} on ${deleting.date} will be removed permanently.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void submitDelete()} disabled={busy}>
              {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewCategoryDialog
        open={newCategoryFor !== null}
        defaultType={newCategoryFor === "edit" ? (editing?.type ?? "EXPENSE") : form.type}
        onClose={() => setNewCategoryFor(null)}
        onCreated={(category) => {
          if (newCategoryFor === "form") {
            setForm((state) =>
              category.type === state.type ? { ...state, categoryId: category.id } : state,
            );
          }
          setNewCategoryFor(null);
        }}
      />

      {/* AI review dialog — nothing is written until Apply. */}
      <Dialog open={suggestions !== null} onOpenChange={(open) => !open && setSuggestions(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review AI suggestions</DialogTitle>
            <DialogDescription>
              Adjust anything that looks off — only rows with a category get applied.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {suggestions?.map((entry) => (
              <li key={entry.transactionId} className="flex items-center gap-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate">{entry.note || "(no note)"}</p>
                  <p className="font-mono text-xs text-muted-foreground tabular-nums">
                    {entry.type === "EXPENSE" ? "−" : "+"}
                    {formatMoney(entry.amountMinor)}
                  </p>
                </div>
                <Select
                  value={picks[entry.transactionId] ?? NONE}
                  onValueChange={(value) =>
                    setPicks((state) => ({ ...state, [entry.transactionId]: value }))
                  }
                >
                  <SelectTrigger
                    size="sm"
                    className="w-44"
                    aria-label={`Category for ${entry.note || "transaction"}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Leave uncategorized</SelectItem>
                    {categories
                      .filter((category) => category.type === entry.type)
                      .map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.icon} {category.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuggestions(null)}>
              Cancel
            </Button>
            <Button onClick={() => void applySuggestions()} disabled={aiBusy}>
              {aiBusy ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="-ml-2 h-7 gap-1 px-2 text-xs" onClick={onClick}>
      {label}
      <ArrowUpDown aria-hidden className="size-3" />
    </Button>
  );
}

function EditTransactionDialog({
  transaction,
  categories,
  onClose,
  onNewCategory,
}: {
  transaction: TransactionDto | null;
  categories: CategoryDto[];
  onClose: () => void;
  onNewCategory: () => void;
}) {
  return (
    <Dialog open={transaction !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit transaction</DialogTitle>
          <DialogDescription>Every field can be changed.</DialogDescription>
        </DialogHeader>
        {transaction ? (
          // Keyed by id so the form state resets whenever another row opens.
          <EditTransactionForm
            key={transaction.id}
            transaction={transaction}
            categories={categories}
            onClose={onClose}
            onNewCategory={onNewCategory}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditTransactionForm({
  transaction,
  categories,
  onClose,
  onNewCategory,
}: {
  transaction: TransactionDto;
  categories: CategoryDto[];
  onClose: () => void;
  onNewCategory: () => void;
}) {
  const [state, setState] = useState<FormState>({
    type: transaction.type,
    amount: String(transaction.amountMinor),
    note: transaction.note,
    date: transaction.date,
    categoryId: transaction.category?.id ?? NONE,
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const amountMinor = parseAmountInput(state.amount);
    if (amountMinor === null) {
      toast.error("Enter a valid amount (whole đồng).");
      return;
    }
    setBusy(true);
    const result = await updateTransactionAction({
      id: transaction.id,
      type: state.type,
      amountMinor,
      note: state.note.trim(),
      date: state.date,
      categoryId: state.categoryId === NONE ? null : state.categoryId,
    });
    setBusy(false);
    if (result.ok) {
      onClose();
    } else {
      toast.error(result.error);
    }
  };

  const typeCategories = categories.filter((category) => category.type === state.type);

  return (
    <>
      <div className="space-y-3">
        <div className="flex rounded-lg border p-0.5" role="group" aria-label="Transaction type">
          {(["EXPENSE", "INCOME"] as const).map((type) => (
            <Button
              key={type}
              type="button"
              variant={state.type === type ? "default" : "ghost"}
              size="sm"
              className="h-7 flex-1 text-xs"
              aria-pressed={state.type === type}
              onClick={() => setState((s) => ({ ...s, type, categoryId: NONE }))}
            >
              {type === "EXPENSE" ? "Expense" : "Income"}
            </Button>
          ))}
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-amount">Amount (₫)</Label>
          <Input
            id="edit-amount"
            inputMode="numeric"
            value={state.amount}
            onChange={(event) => setState((s) => ({ ...s, amount: event.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-note">Note</Label>
          <Input
            id="edit-note"
            value={state.note}
            maxLength={200}
            onChange={(event) => setState((s) => ({ ...s, note: event.target.value }))}
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <Label>Category</Label>
            <Select
              value={state.categoryId}
              onValueChange={(value) => {
                if (value === NEW) {
                  onNewCategory();
                  return;
                }
                setState((s) => ({ ...s, categoryId: value }));
              }}
            >
              <SelectTrigger className="w-full" aria-label="Category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No category</SelectItem>
                {typeCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW}>+ New category…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-date">Date</Label>
            <Input
              id="edit-date"
              type="date"
              value={state.date}
              onChange={(event) => setState((s) => ({ ...s, date: event.target.value }))}
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => void submit()} disabled={busy}>
          {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
          Save
        </Button>
      </DialogFooter>
    </>
  );
}

function NewCategoryDialog({
  open,
  defaultType,
  onClose,
  onCreated,
}: {
  open: boolean;
  defaultType: TransactionTypeDto;
  onClose: () => void;
  onCreated: (category: CategoryDto) => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const result = await createCategoryAction({
      name: name.trim(),
      type: defaultType,
      icon: icon.trim() || undefined,
    });
    setBusy(false);
    if (result.ok) {
      setName("");
      setIcon("");
      onCreated(result.data);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New {defaultType === "EXPENSE" ? "expense" : "income"} category</DialogTitle>
          <DialogDescription>
            Categories power budgets, charts and AI suggestions.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            value={icon}
            onChange={(event) => setIcon(event.target.value)}
            placeholder="🍜"
            aria-label="Category icon"
            maxLength={8}
            className="w-16 text-center"
          />
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
            placeholder="Category name"
            aria-label="Category name"
            maxLength={40}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !name.trim()}>
            {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
