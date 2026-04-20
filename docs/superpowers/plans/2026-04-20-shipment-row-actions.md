# Shipment Row Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the 3-dot dropdown menu on `/dashboard/shipments` (View Details, Edit, Share, Delete) and the matching sidebar actions on the shipment detail page — so all four actions work correctly.

**Architecture:** Fix broken route paths, introduce a single `EditShipmentModal` built on `@radix-ui/react-dialog` (same pattern as existing `AddShipmentDialog`), reuse it in both the dropdown (table) and the sidebar (detail page). Share copies the public `/track/{trackingNumber}` URL.

**Tech Stack:** Next.js 15 App Router, React 19 client components, Radix UI Dialog, Tailwind CSS.

**Project note:** `D:\trackmycontainer` is NOT a git repo. Steps do not include `git commit`. After each task, verify the app still builds (`npm run dev` stays green) before moving to the next.

**Spec:** [docs/superpowers/specs/2026-04-20-shipment-row-actions-design.md](../specs/2026-04-20-shipment-row-actions-design.md)

---

## File Map

| Path | Action | Responsibility |
|------|--------|----------------|
| `src/frontend/components/dashboard/edit-shipment-modal.tsx` | **Create** | Reusable modal for editing a shipment's `nickname` |
| `src/frontend/components/dashboard/shipments-table.tsx` | **Modify** | Fix View Details link, wire modal for Edit, fix Share URL, improve Delete confirm message |
| `src/app/(dashboard)/dashboard/shipments/[id]/shipment-actions.tsx` | **Modify** | Accept `trackingNumber` + `nickname` props, wire modal for Edit, fix Share URL, fix post-delete redirect |
| `src/app/(dashboard)/dashboard/shipments/[id]/page.tsx` | **Modify** | Pass `trackingNumber` + `nickname` to `<ShipmentActions>` |

---

## Task 1: Create EditShipmentModal component

**Files:**
- Create: `src/frontend/components/dashboard/edit-shipment-modal.tsx`

- [ ] **Step 1: Create the modal file**

Create `src/frontend/components/dashboard/edit-shipment-modal.tsx` with this exact content:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Loader2, AlertCircle, Pencil } from "lucide-react";

interface Props {
  shipmentId: string;
  trackingNumber: string;
  currentNickname: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditShipmentModal({
  shipmentId,
  trackingNumber,
  currentNickname,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [nickname, setNickname] = useState(currentNickname ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when the modal opens for a different shipment
  useEffect(() => {
    if (open) {
      setNickname(currentNickname ?? "");
      setError(null);
      setLoading(false);
    }
  }, [open, currentNickname]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const trimmed = nickname.trim();
      const res = await fetch(`/api/shipments/${shipmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: trimmed === "" ? null : trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Failed to update shipment. Please try again.",
        );
      }

      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2
                     rounded-2xl border border-navy-200 bg-white p-6 shadow-xl
                     dark:border-navy-700 dark:bg-navy-900
                     animate-in fade-in-0 zoom-in-95"
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="flex items-center gap-2 text-lg font-extrabold text-navy-900 dark:text-white">
              <Pencil size={18} className="text-teal-500" />
              Edit Shipment
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg
                           text-navy-400 transition-colors hover:bg-navy-100 hover:text-navy-600
                           dark:text-navy-500 dark:hover:bg-navy-800 dark:hover:text-navy-200"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="mt-1 text-sm text-navy-400 dark:text-navy-400">
            <span className="font-mono text-navy-600 dark:text-navy-300">{trackingNumber}</span>
          </Dialog.Description>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5
                            dark:border-red-500/30 dark:bg-red-500/10">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-500 dark:text-red-400" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-navy-500 dark:text-navy-400 mb-1.5">
                Nickname <span className="text-navy-300 dark:text-navy-600 font-normal normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Order #1234"
                maxLength={100}
                autoFocus
                className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm
                           text-navy-900 placeholder:text-navy-400
                           focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20
                           dark:border-navy-700 dark:bg-navy-800 dark:text-white dark:placeholder:text-navy-500
                           dark:focus:border-teal-400 dark:focus:ring-teal-400/20"
              />
              <p className="mt-1 text-xs text-navy-400 dark:text-navy-500">
                Give this shipment a memorable name. Leave empty to remove.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={loading}
                  className="rounded-lg border border-navy-200 px-4 py-2 text-sm font-semibold text-navy-700
                             transition-colors hover:bg-navy-50
                             dark:border-navy-700 dark:text-navy-300 dark:hover:bg-navy-800
                             disabled:opacity-50"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-bold text-white
                           transition-colors hover:bg-teal-600
                           focus:outline-none focus:ring-2 focus:ring-teal-500/40
                           disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run in a second terminal (or restart dev server if already running):

```bash
cd D:/trackmycontainer
npm run dev
```

Expected: Server starts without TypeScript errors, reachable at http://localhost:3000. No changes to UI yet — this task only adds the component; it is not wired up.

---

## Task 2: Wire dropdown menu in shipments-table.tsx

**Files:**
- Modify: `src/frontend/components/dashboard/shipments-table.tsx`

- [ ] **Step 1: Add the edit modal import**

Add this import near the top of the file, grouped with other component imports (after the `DropdownMenu` import, around line 19):

```tsx
import { EditShipmentModal } from "./edit-shipment-modal";
```

- [ ] **Step 2: Add edit modal state inside the component**

In the `ShipmentsTable` function body, add a new `useState` right after the existing `loadingId` state (around line 87):

```tsx
const [editing, setEditing] = useState<{
  id: string;
  trackingNumber: string;
  nickname: string | null;
} | null>(null);
```

- [ ] **Step 3: Change the `shareShipment` function to accept a tracking number**

Replace the existing `shareShipment` function (lines 145-149) with:

```tsx
async function shareShipment(trackingNumber: string) {
  const url = `${window.location.origin}/track/${trackingNumber}`;
  await navigator.clipboard.writeText(url);
  alert("Share link copied to clipboard!");
}
```

- [ ] **Step 4: Change the `deleteShipment` function to include tracking number in the confirm message**

Replace the existing `deleteShipment` function (lines 134-143) with:

```tsx
async function deleteShipment(id: string, trackingNumber: string) {
  if (!confirm(`Delete shipment ${trackingNumber}? This cannot be undone.`)) return;
  setLoadingId(id);
  try {
    await fetch(`/api/shipments/${id}`, { method: "DELETE" });
    router.refresh();
  } finally {
    setLoadingId(null);
  }
}
```

- [ ] **Step 5: Fix View Details link path**

In the dropdown `DropdownMenu.Item` for View Details (around line 352-362), change the `href`:

```tsx
<DropdownMenu.Item asChild>
  <Link
    href={`/dashboard/shipments/${s.id}`}
    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-navy-700
               outline-none hover:bg-navy-50 dark:text-navy-200 dark:hover:bg-navy-800
               cursor-pointer"
  >
    <Eye size={14} />
    View Details
  </Link>
</DropdownMenu.Item>
```

- [ ] **Step 6: Change the Edit dropdown item to open the modal**

Replace the Edit `DropdownMenu.Item` (around line 364-372) with:

```tsx
<DropdownMenu.Item
  onSelect={() =>
    setEditing({ id: s.id, trackingNumber: s.trackingNumber, nickname: s.nickname })
  }
  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-navy-700
             outline-none hover:bg-navy-50 dark:text-navy-200 dark:hover:bg-navy-800
             cursor-pointer"
>
  <Pencil size={14} />
  Edit
</DropdownMenu.Item>
```

- [ ] **Step 7: Update Share dropdown item to pass tracking number**

Replace the Share `DropdownMenu.Item` (around line 374-382) with:

```tsx
<DropdownMenu.Item
  onSelect={() => shareShipment(s.trackingNumber)}
  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-navy-700
             outline-none hover:bg-navy-50 dark:text-navy-200 dark:hover:bg-navy-800
             cursor-pointer"
>
  <Share2 size={14} />
  Share
</DropdownMenu.Item>
```

- [ ] **Step 8: Update Delete dropdown item to pass tracking number**

Replace the Delete `DropdownMenu.Item` (around line 386-394) with:

```tsx
<DropdownMenu.Item
  onSelect={() => deleteShipment(s.id, s.trackingNumber)}
  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600
             outline-none hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10
             cursor-pointer"
>
  <Trash2 size={14} />
  Delete
</DropdownMenu.Item>
```

- [ ] **Step 9: Render the modal at the bottom of the returned JSX**

At the very end of the `return (...)` block in the component, immediately before the closing `</div>` of the outermost `<div className="space-y-4">`, add:

```tsx
      <EditShipmentModal
        shipmentId={editing?.id ?? ""}
        trackingNumber={editing?.trackingNumber ?? ""}
        currentNickname={editing?.nickname ?? null}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
```

- [ ] **Step 10: Verify no TypeScript errors**

In the running dev server terminal, look for compile errors. If you see none, open http://localhost:3000/dashboard/shipments and:

1. Click the 3-dot menu on any row.
2. Verify all 4 items render (View Details, Edit, Share, Delete).
3. Don't interact yet — full verification is in Task 5.

Expected: No console errors. Menu opens and displays items.

---

## Task 3: Wire sidebar actions in shipment-actions.tsx

**Files:**
- Modify: `src/app/(dashboard)/dashboard/shipments/[id]/shipment-actions.tsx`

- [ ] **Step 1: Expand the Props interface**

Replace lines 8-11 (the `Props` interface) with:

```tsx
interface Props {
  shipmentId: string;
  trackingNumber: string;
  nickname: string | null;
  isFavorite: boolean;
}
```

- [ ] **Step 2: Add `useState` import and EditShipmentModal import**

Line 3 currently imports `useState`. Leave that. Below the `cn` import (after line 6), add:

```tsx
import { EditShipmentModal } from "@/frontend/components/dashboard/edit-shipment-modal";
```

- [ ] **Step 3: Update the component signature to destructure new props**

Line 13 currently is:

```tsx
export function ShipmentActions({ shipmentId, isFavorite }: Props) {
```

Change it to:

```tsx
export function ShipmentActions({ shipmentId, trackingNumber, nickname, isFavorite }: Props) {
```

- [ ] **Step 4: Add edit modal state**

Inside the component body, right after `const [loading, setLoading] = useState<string | null>(null);` (line 15), add:

```tsx
const [editOpen, setEditOpen] = useState(false);
```

- [ ] **Step 5: Fix the share function**

Replace lines 31-35 (the `shareShipment` function) with:

```tsx
async function shareShipment() {
  const url = `${window.location.origin}/track/${trackingNumber}`;
  await navigator.clipboard.writeText(url);
  alert("Share link copied to clipboard!");
}
```

- [ ] **Step 6: Fix the delete redirect path and confirm message**

Replace lines 37-47 (the `deleteShipment` function) with:

```tsx
async function deleteShipment() {
  if (!confirm(`Delete shipment ${trackingNumber}? This cannot be undone.`)) return;
  setLoading("delete");
  try {
    await fetch(`/api/shipments/${shipmentId}`, { method: "DELETE" });
    router.push("/dashboard/shipments");
    router.refresh();
  } finally {
    setLoading(null);
  }
}
```

- [ ] **Step 7: Change Edit button to open the modal**

Replace the Edit button block (lines 76-84):

```tsx
<button
  onClick={() => router.push(`/shipments/${shipmentId}?edit=true`)}
  className="flex w-full items-center gap-2 rounded-lg border border-navy-200 px-3 py-2.5 text-sm
             font-semibold text-navy-700 transition-colors hover:bg-navy-50
             dark:border-navy-700 dark:text-navy-300 dark:hover:bg-navy-800"
>
  <Pencil size={16} />
  Edit Shipment
</button>
```

With:

```tsx
<button
  onClick={() => setEditOpen(true)}
  className="flex w-full items-center gap-2 rounded-lg border border-navy-200 px-3 py-2.5 text-sm
             font-semibold text-navy-700 transition-colors hover:bg-navy-50
             dark:border-navy-700 dark:text-navy-300 dark:hover:bg-navy-800"
>
  <Pencil size={16} />
  Edit Shipment
</button>
```

- [ ] **Step 8: Render the modal inside the component**

The component currently returns a `<div className="space-y-2">...</div>`. Wrap the return in a fragment and add the modal after the div. Replace the full `return (...)` block (lines 49-111) with:

```tsx
return (
  <>
    <div className="space-y-2">
      <h4 className="text-xs font-bold uppercase tracking-wider text-navy-400 dark:text-navy-500">
        Actions
      </h4>

      <button
        onClick={toggleFavorite}
        disabled={loading === "favorite"}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors",
          isFavorite
            ? "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300 dark:hover:bg-orange-500/20"
            : "border-navy-200 text-navy-700 hover:bg-navy-50 dark:border-navy-700 dark:text-navy-300 dark:hover:bg-navy-800",
        )}
      >
        {loading === "favorite" ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Star
            size={16}
            className={cn(isFavorite && "fill-orange-400 text-orange-400")}
          />
        )}
        {isFavorite ? "Remove from Favorites" : "Add to Favorites"}
      </button>

      <button
        onClick={() => setEditOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-navy-200 px-3 py-2.5 text-sm
                   font-semibold text-navy-700 transition-colors hover:bg-navy-50
                   dark:border-navy-700 dark:text-navy-300 dark:hover:bg-navy-800"
      >
        <Pencil size={16} />
        Edit Shipment
      </button>

      <button
        onClick={shareShipment}
        className="flex w-full items-center gap-2 rounded-lg border border-navy-200 px-3 py-2.5 text-sm
                   font-semibold text-navy-700 transition-colors hover:bg-navy-50
                   dark:border-navy-700 dark:text-navy-300 dark:hover:bg-navy-800"
      >
        <Share2 size={16} />
        Share Tracking
      </button>

      <button
        onClick={deleteShipment}
        disabled={loading === "delete"}
        className="flex w-full items-center gap-2 rounded-lg border border-red-200 px-3 py-2.5 text-sm
                   font-semibold text-red-600 transition-colors hover:bg-red-50
                   dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
      >
        {loading === "delete" ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Trash2 size={16} />
        )}
        Delete Shipment
      </button>
    </div>

    <EditShipmentModal
      shipmentId={shipmentId}
      trackingNumber={trackingNumber}
      currentNickname={nickname}
      open={editOpen}
      onOpenChange={setEditOpen}
    />
  </>
);
```

- [ ] **Step 9: Verify compilation**

Check the dev server output. Expected: No TypeScript errors. The page at `/dashboard/shipments/[id]` will show a compile error for missing props on `<ShipmentActions>` — that's fixed in Task 4.

---

## Task 4: Pass new props to ShipmentActions in detail page

**Files:**
- Modify: `src/app/(dashboard)/dashboard/shipments/[id]/page.tsx` (line 416-419)

- [ ] **Step 1: Update the `<ShipmentActions>` call**

Find the `<ShipmentActions>` usage (around line 416). Replace:

```tsx
<ShipmentActions
  shipmentId={shipment.id}
  isFavorite={shipment.isFavorite}
/>
```

With:

```tsx
<ShipmentActions
  shipmentId={shipment.id}
  trackingNumber={shipment.trackingNumber}
  nickname={shipment.nickname}
  isFavorite={shipment.isFavorite}
/>
```

- [ ] **Step 2: Verify compilation**

Check the dev server terminal. Expected: No TypeScript errors. Page at `/dashboard/shipments/{id}` loads successfully with the sidebar.

---

## Task 5: End-to-end manual verification

**Files:** None (verification only).

- [ ] **Step 1: Ensure dev server is running**

If not already running:

```bash
cd D:/trackmycontainer
npm run dev
```

Then open http://localhost:3000/dashboard/shipments (log in if needed).

- [ ] **Step 2: Verify View Details (dropdown)**

1. Click the 3-dot menu on any row.
2. Click "View Details".

Expected: Navigates to `/dashboard/shipments/{id}` and loads the detail page with timeline, map, sidebar.

- [ ] **Step 3: Verify Edit (dropdown)**

1. Return to `/dashboard/shipments`.
2. Click the 3-dot menu on a row → "Edit".
3. Modal opens showing the tracking number and a pre-filled (or empty) nickname field.
4. Type "Test Nickname" → click "Save Changes".

Expected:
- Modal closes.
- The row's nickname column updates to "Test Nickname" (visible under the tracking number in the table).
- No console errors.

- [ ] **Step 4: Verify Edit can clear the nickname**

1. Click the 3-dot menu → "Edit" on the same row.
2. Clear the input → click "Save Changes".

Expected: Modal closes; nickname subtitle disappears from the row.

- [ ] **Step 5: Verify Share (dropdown)**

1. Click the 3-dot menu on any row → "Share".
2. An `alert` shows "Share link copied to clipboard!".
3. Paste into the URL bar or a text editor.

Expected: URL format is `http://localhost:3000/track/<TRACKING_NUMBER>` (e.g. `…/track/MEDU9091004`), NOT a UUID.

4. Open that URL in a new incognito window (or a different browser).

Expected: Public tracking page loads and shows the shipment's status, timeline, route. No login prompt.

- [ ] **Step 6: Verify Delete (dropdown)**

1. Click the 3-dot menu on a test row → "Delete".
2. Confirm dialog message shows `Delete shipment <TRACKING_NUMBER>? This cannot be undone.`
3. Click OK.

Expected: Row disappears from the table. No console errors.

- [ ] **Step 7: Verify sidebar actions on detail page**

Navigate to `/dashboard/shipments/{id}` for a remaining shipment.

1. Click "Edit Shipment" in the right sidebar → same modal opens with the shipment's current nickname.
2. Change nickname → Save → sidebar reflects update on refresh.
3. Click "Share Tracking" → clipboard contains `/track/{trackingNumber}`.
4. Click "Delete Shipment" → confirm shows tracking number → OK → redirects to `/dashboard/shipments`.

Expected: All three sidebar actions work identically to the dropdown equivalents.

- [ ] **Step 8: Check console + network**

Throughout verification, keep browser DevTools open:
- Console: no uncaught errors.
- Network: `PATCH /api/shipments/{id}` returns 200 with updated shipment JSON. `DELETE /api/shipments/{id}` returns 200. No 404s on any action.

---

## Self-Review (completed by plan author)

- **Spec coverage:**
  - View Details path fix → Task 2 Step 5, Task 4 (via correct detail page already at right path)
  - Edit modal → Task 1 (create) + Task 2 Steps 2, 6, 9 (table integration) + Task 3 Steps 4, 7, 8 (sidebar integration)
  - Share fix (use trackingNumber) → Task 2 Step 3 + Task 3 Step 5
  - Delete improvement (tracking-number confirm) → Task 2 Step 4 + Task 3 Step 6
  - Fix post-delete redirect in sidebar → Task 3 Step 6
  - Out-of-scope items (custom delete modal, other editable fields, share tokens) correctly NOT included as tasks.
- **Placeholder scan:** No TBDs, no "add appropriate error handling", all code blocks are complete.
- **Type consistency:** `EditShipmentModal` props (`shipmentId`, `trackingNumber`, `currentNickname`, `open`, `onOpenChange`) are used identically in both Task 2 Step 9 and Task 3 Step 8. `ShipmentActions` props (`shipmentId`, `trackingNumber`, `nickname`, `isFavorite`) match between Task 3 Step 1 (interface), Task 3 Step 3 (destructure), and Task 4 Step 1 (caller).
