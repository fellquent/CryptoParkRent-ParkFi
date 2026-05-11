import { ZeroAddress } from "ethers";
import {
  getBooking,
  getSpotBookings
} from "./bookingManagerReadService";
import {
  getAllActiveSpots,
  getParkingSpot,
  getTotalSpots
} from "./parkingRegistryReadService";
import {
  getSpotUser,
  getSpotUserExpires,
  getTokenOwner
} from "./parkingPermitNftReadService";
import { formatPricePerHour } from "../utils/formatters";

function normalizeSpotStruct(rawSpot) {
  return {
    description: rawSpot.description ?? rawSpot[3],
    id: rawSpot.id ?? rawSpot[0],
    isActive: rawSpot.isActive ?? rawSpot[9],
    isAvailable: rawSpot.isAvailable ?? rawSpot[7],
    latitudeE6: rawSpot.latitudeE6 ?? rawSpot[4],
    locationName: rawSpot.locationName ?? rawSpot[2],
    longitudeE6: rawSpot.longitudeE6 ?? rawSpot[5],
    owner: rawSpot.owner ?? rawSpot[1],
    pricePerHour: rawSpot.pricePerHour ?? rawSpot[6],
    vehicleSize: rawSpot.vehicleSize ?? rawSpot[8]
  };
}

function coordinateFromE6(value) {
  return Number(value) / 1_000_000;
}

function getMarkerStatus(spot, currentUser) {
  if (!spot.isAvailable) {
    return "inactive";
  }

  if (spot.isUsedNow || (currentUser && currentUser !== ZeroAddress)) {
    return "reserved";
  }

  return "available";
}

function normalizeBookingStruct(rawBooking) {
  return {
    endTime: rawBooking.endTime ?? rawBooking[5],
    startTime: rawBooking.startTime ?? rawBooking[4],
    status: Number(rawBooking.status ?? rawBooking[8])
  };
}

async function getIsSpotUsedNow(bookingManager, spotId) {
  const now = Math.floor(Date.now() / 1000);
  const bookingIds = await getSpotBookings(bookingManager, spotId);
  const bookings = await Promise.all(
    bookingIds.map((bookingId) => getBooking(bookingManager, bookingId))
  );

  return bookings.some((rawBooking) => {
    const booking = normalizeBookingStruct(rawBooking);
    const blocksCurrentUse =
      booking.status === 0 || booking.status === 1 || booking.status === 2;

    return (
      blocksCurrentUse &&
      Number(booking.startTime) <= now &&
      Number(booking.endTime) > now
    );
  });
}

function buildMapSpots(spots) {
  return spots.map((spot) => ({
    ...spot,
    latitude: coordinateFromE6(spot.latitudeE6),
    longitude: coordinateFromE6(spot.longitudeE6)
  }));
}

function buildSessionLabel(expiresAt) {
  const remainingMs = Number(expiresAt) * 1000 - Date.now();

  if (remainingMs <= 0) {
    return "Expired";
  }

  const remainingMinutes = Math.floor(remainingMs / 60000);
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }

  return `${minutes}m remaining`;
}

export async function loadHomePageData(contracts, account) {
  const totalSpots = Number(await getTotalSpots(contracts.parkingRegistry));

  if (totalSpots === 0) {
    return {
      activeSessions: [],
      featuredSpots: [],
      metrics: {
        activeSessions: 0,
        availableSpots: 0,
        ownedSpots: 0
      },
      spots: []
    };
  }

  const spotPromises = Array.from({ length: totalSpots }, async (_, index) => {
    const spotId = index + 1;
    const [spot, owner, currentUser, userExpires, isUsedNow] = await Promise.all([
      getParkingSpot(contracts.parkingRegistry, spotId),
      getTokenOwner(contracts.parkingPermitNft, spotId),
      getSpotUser(contracts.parkingPermitNft, spotId),
      getSpotUserExpires(contracts.parkingPermitNft, spotId),
      getIsSpotUsedNow(contracts.bookingManager, spotId)
    ]);

    const normalizedSpot = normalizeSpotStruct(spot);

    return {
      ...normalizedSpot,
      currentUser,
      displayPrice: formatPricePerHour(normalizedSpot.pricePerHour),
      isUsedNow,
      owner,
      status: getMarkerStatus({ ...normalizedSpot, isUsedNow }, currentUser),
      tokenId: spotId,
      userExpires
    };
  });

  const spots = buildMapSpots(
    (await Promise.all(spotPromises)).filter((spot) => spot.isActive)
  );
  const activeSessions = spots
    .filter((spot) => spot.currentUser?.toLowerCase() === account?.toLowerCase())
    .map((spot) => ({
      expiresLabel: buildSessionLabel(spot.userExpires),
      id: spot.id,
      locationName: spot.locationName,
      owner: spot.owner,
      userExpires: spot.userExpires
    }));

  const ownedSpots = spots.filter(
    (spot) => spot.owner?.toLowerCase() === account?.toLowerCase()
  );

  const availableSpots = spots.filter((spot) => spot.status === "available");
  const featuredSpots = (
    await getAllActiveSpots(contracts.parkingRegistry)
  ).map((spot) => normalizeSpotStruct(spot));

  return {
    activeSessions,
    featuredSpots,
    metrics: {
      activeSessions: activeSessions.length,
      availableSpots: availableSpots.length,
      ownedSpots: ownedSpots.length
    },
    spots
  };
}
