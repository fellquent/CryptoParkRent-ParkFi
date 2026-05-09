export const BOOKING_MANAGER_ADDRESS =
  import.meta.env.VITE_BOOKING_MANAGER_ADDRESS;

export function validateBookingManagerConfig() {
  if (!BOOKING_MANAGER_ADDRESS) {
    throw new Error("Missing VITE_BOOKING_MANAGER_ADDRESS configuration.");
  }
}
