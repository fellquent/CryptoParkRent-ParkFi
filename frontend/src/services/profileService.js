import { getBooking, getSpotBookings } from "./bookingManagerReadService";
import { getOwnerSpots, getParkingSpot } from "./parkingRegistryReadService";
import { formatEthAmount, formatPricePerHour } from "../utils/formatters";

const bookingStatuses = ["Reserved", "Active", "Completed", "Cancelled"];

function normalizeSpotStruct(rawSpot) {
  const pricePerHour = rawSpot.pricePerHour ?? rawSpot[6];

  return {
    capacity: rawSpot.capacity ?? rawSpot[8],
    description: rawSpot.description ?? rawSpot[3],
    displayPrice: formatPricePerHour(pricePerHour),
    id: rawSpot.id ?? rawSpot[0],
    isActive: rawSpot.isActive ?? rawSpot[9],
    isAvailable: rawSpot.isAvailable ?? rawSpot[7],
    latitudeE6: rawSpot.latitudeE6 ?? rawSpot[4],
    locationName: rawSpot.locationName ?? rawSpot[2],
    longitudeE6: rawSpot.longitudeE6 ?? rawSpot[5],
    owner: rawSpot.owner ?? rawSpot[1],
    pricePerHour
  };
}

function normalizeBookingStruct(rawBooking, spot = null) {
  const startTime = rawBooking.startTime ?? rawBooking[4];
  const endTime = rawBooking.endTime ?? rawBooking[5];
  const status = Number(rawBooking.status ?? rawBooking[8]);

  return {
    endTime,
    id: rawBooking.id ?? rawBooking[0],
    renter: rawBooking.renter ?? rawBooking[2],
    spot,
    spotId: rawBooking.spotId ?? rawBooking[1],
    spotOwner: rawBooking.spotOwner ?? rawBooking[3],
    startLabel: formatDateFromSeconds(startTime),
    startTime,
    status,
    statusLabel: bookingStatuses[status] || "Unknown",
    timeLabel: `${formatDateFromSeconds(startTime)} - ${formatDateFromSeconds(endTime)}`,
    totalPrice: rawBooking.totalPrice ?? rawBooking[6],
    totalPriceLabel: formatEthAmount(rawBooking.totalPrice ?? rawBooking[6])
  };
}

function formatDateFromSeconds(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return new Date(Number(value) * 1000).toLocaleString();
}

function isCurrentBooking(booking) {
  const now = Math.floor(Date.now() / 1000);

  return Number(booking.endTime) >= now && booking.status !== 3;
}

async function getSpotSafe(parkingRegistry, spotId) {
  try {
    return normalizeSpotStruct(await getParkingSpot(parkingRegistry, spotId));
  } catch {
    return null;
  }
}

export async function loadOwnerSpots(contracts, account) {
  if (!account) {
    return [];
  }

  const spotIds = await getOwnerSpots(contracts.parkingRegistry, account);
  const rawSpots = await Promise.all(
    spotIds.map((spotId) => getParkingSpot(contracts.parkingRegistry, spotId))
  );

  return rawSpots.map((spot) => normalizeSpotStruct(spot));
}

export async function loadBookingsForOwnedSpots(contracts, ownerSpots) {
  const spotBookings = await Promise.all(
    ownerSpots.map(async (spot) => {
      const bookingIds = await getSpotBookings(contracts.bookingManager, spot.id);
      const bookings = await Promise.all(
        bookingIds.map(async (bookingId) =>
          normalizeBookingStruct(
            await getBooking(contracts.bookingManager, bookingId),
            spot
          )
        )
      );

      return bookings;
    })
  );

  return spotBookings.flat();
}

export async function loadRenterBookings(contracts, account) {
  if (!account || !contracts.bookingManager.queryFilter) {
    return [];
  }

  const filter = contracts.bookingManager.filters.SpotBooked(null, null, account);
  const events = await contracts.bookingManager.queryFilter(filter, 0, "latest");
  const uniqueBookingIds = [
    ...new Set(events.map((event) => event.args.bookingId.toString()))
  ];

  const bookings = await Promise.all(
    uniqueBookingIds.map(async (bookingId) => {
      const booking = await getBooking(contracts.bookingManager, bookingId);
      const spotId = booking.spotId ?? booking[1];
      const spot = await getSpotSafe(contracts.parkingRegistry, spotId);

      return normalizeBookingStruct(booking, spot);
    })
  );

  return bookings.sort((a, b) => Number(b.startTime) - Number(a.startTime));
}

export function splitBookingsByTime(bookings) {
  return {
    current: bookings.filter((booking) => isCurrentBooking(booking)),
    history: bookings.filter((booking) => !isCurrentBooking(booking))
  };
}
