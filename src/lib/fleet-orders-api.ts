import type { FleetOrderStatus } from '@prisma/client';
import { FLEET_ORDER_STATUS_LABELS } from '@/lib/fleet-order-status';

export type FleetOrderListRow = {
  id: string;
  orderNumber: string;
  status: FleetOrderStatus;
  statusLabel: string;
  customerId: string;
  customerName: string;
  pickupLocation: string;
  deliveryLocation: string;
  cargoType: string | null;
  cargoWeightKg: number | null;
  truckRequirements: string | null;
  requestedPickupAt: string | null;
  deliveryDeadlineAt: string | null;
  tripCount: number;
  createdAt: string;
  updatedAt: string;
};

export function orderToListRow(order: {
  id: string;
  orderNumber: string;
  status: FleetOrderStatus;
  customerId: string;
  pickupLocation: string;
  deliveryLocation: string;
  cargoType: string | null;
  cargoWeightKg: number | null;
  truckRequirements: string | null;
  requestedPickupAt: Date | null;
  deliveryDeadlineAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  customer: { name: string };
  _count?: { trips: number };
}): FleetOrderListRow {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    statusLabel: FLEET_ORDER_STATUS_LABELS[order.status],
    customerId: order.customerId,
    customerName: order.customer.name,
    pickupLocation: order.pickupLocation,
    deliveryLocation: order.deliveryLocation,
    cargoType: order.cargoType,
    cargoWeightKg: order.cargoWeightKg,
    truckRequirements: order.truckRequirements,
    requestedPickupAt: order.requestedPickupAt?.toISOString() ?? null,
    deliveryDeadlineAt: order.deliveryDeadlineAt?.toISOString() ?? null,
    tripCount: order._count?.trips ?? 0,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
