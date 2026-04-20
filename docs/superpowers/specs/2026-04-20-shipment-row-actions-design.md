# Shipment Row Actions — Design

**Date:** 2026-04-20
**Scope:** Wire up the 3-dot dropdown menu on `/dashboard/shipments` (View Details, Edit, Share, Delete) and fix the equivalent action buttons on the shipment detail page sidebar.

## Context

The dropdown menu exists in `src/frontend/components/dashboard/shipments-table.tsx` but several items are broken:

| Action | Current behavior | Problem |
|--------|------------------|---------|
| View Details | `<Link href="/shipments/{id}">` | Wrong path — actual route is `/dashboard/shipments/{id}` |
| Edit | `router.push("/shipments/{id}?edit=true")` | Wrong path + the detail page never reads `?edit=true`, so nothing happens |
| Share | Copies `${origin}/track/{shipment.id}` (UUID) | `/track/[id]` expects a tracking number, not a UUID → broken link |
| Delete | `DELETE /api/shipments/{id}` | Works, but native `confirm()` message is generic |

The same action set exists on the detail page sidebar in `shipment-actions.tsx` with the same Edit/Share bugs (Delete here does redirect to `/shipments` which is also a broken path).

## Decisions

1. **View Details** — fix path to `/dashboard/shipments/{id}`.
2. **Edit** — open a modal dialog; allow editing `nickname` only. Other fields (`origin`, `destination`, `etaDate`) are provider-sourced and not user-owned.
3. **Share** — copy the public tracking URL `/track/{trackingNumber}` (option A). The user approved this: tracking numbers are already public, and the recipient sees the live tracking page with timeline, status, route, ETA — but NOT the user's private `nickname`.
4. **Delete** — keep native `confirm()` (user did not request a custom modal); improve wording to include tracking number; keep existing loading state. Fix post-delete redirect path in `shipment-actions.tsx` from `/shipments` to `/dashboard/shipments`.

## Components

### New: `EditShipmentModal`

**Path:** `src/frontend/components/dashboard/edit-shipment-modal.tsx`

**Props:**
```ts
interface Props {
  shipmentId: string;
  trackingNumber: string;       // displayed in header
  currentNickname: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Behavior:**
- Built on `@radix-ui/react-dialog` (already installed at `^1.1.6`).
- Single input: `Nickname` — optional, `max 100 chars` (matches `updateShipmentSchema` in `src/lib/validations.ts`).
- Pre-filled with `currentNickname`.
- Save calls `PATCH /api/shipments/{shipmentId}` with `{ nickname }` (empty string → `null`).
- Loading state on Save button; disable both buttons while saving.
- On success: close modal, call `router.refresh()`.
- On error: show inline error text below input.

### Modified: `shipments-table.tsx`

- Lift dropdown row state to track which shipment's edit modal is open (single modal instance at table level, not per row, to avoid mounting N dialogs).
- State: `editingShipment: { id: string; trackingNumber: string; nickname: string | null } | null`.
- View Details link → `/dashboard/shipments/{id}`.
- Edit item → sets `editingShipment`.
- Share item → `shareShipment(s.trackingNumber)` (change param from `id` to `trackingNumber`).
- Delete confirm message: `Delete shipment ${trackingNumber}? This cannot be undone.`

### Modified: `shipment-actions.tsx`

- Add local `editOpen` state.
- Render the same `EditShipmentModal` component.
- Replace `router.push(".../${id}?edit=true")` with `setEditOpen(true)`.
- Fix post-delete redirect to `/dashboard/shipments`.
- Fix share URL to use tracking number (requires prop addition — pass `trackingNumber` from parent page.tsx).

## Data Flow

```
User clicks "Edit" in dropdown
    → table sets editingShipment = { id, trackingNumber, nickname }
    → <EditShipmentModal open={true} /> renders
    → user edits nickname, clicks Save
    → PATCH /api/shipments/{id} { nickname }
    → modal closes, router.refresh()
    → table re-renders with new nickname
```

## Error Handling

- Network/API errors → inline error text inside modal, modal stays open so user can retry.
- Empty nickname → allowed (clears the field, stored as `null`).
- Client-side validation mirrors server (`updateShipmentSchema`).

## Testing

Manual verification (follow preview workflow):
1. Start dev server.
2. Open `/dashboard/shipments`, click "⋯" on a row.
3. Click "View Details" → navigates to `/dashboard/shipments/{id}`.
4. Click "Edit" → modal opens with current nickname → change → Save → row updates.
5. Click "Share" → clipboard contains `/track/{trackingNumber}` (verify via paste).
6. Click "Delete" → confirm dialog shows tracking number → confirm → row disappears.
7. On detail page, repeat Edit/Share/Delete from sidebar.

## Out of Scope

- Custom delete confirmation modal (user did not request).
- Editing non-nickname fields (they are provider-sourced).
- Share tokens / revocable private links (option B rejected in favor of option A).
- Toast notification library — keep existing `alert()` for share success for now.
