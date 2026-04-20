import { redirect } from "next/navigation";

/**
 * /dashboard/shipments/new — redirect to the shipments list.
 * The "Add Shipment" dialog lives on the shipments page itself.
 */
export default function NewShipmentPage() {
  redirect("/dashboard/shipments");
}
