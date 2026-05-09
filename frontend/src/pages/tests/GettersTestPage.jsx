import { useState } from "react";
import { useContractConnection } from "../../state/contractConnectionContext";
import {
  getAccumulatedFees,
  getBooking,
  getBookingManagerOwner,
  getBookingManagerPaused,
  getPermitNftAddress,
  getPlatformFeeBps,
  getRegistryAddress,
  getSpotBookings
} from "../../services/bookingManagerReadService";
import {
  getAllActiveSpots,
  getOwnerSpots,
  getParkingRegistryOwner,
  getParkingRegistryPaused,
  getParkingSpot,
  getTotalSpots
} from "../../services/parkingRegistryReadService";
import {
  getParkingPermitBookingManager,
  getParkingPermitNftName,
  getParkingPermitNftOwner,
  getParkingPermitNftSymbol,
  getParkingPermitRegistry,
  getSpotTokenUri,
  getSpotUser,
  getSpotUserExpires,
  getSupportsInterface,
  getTokenBalance,
  getTokenOwner
} from "../../services/parkingPermitNftReadService";
import { normalizeContractValue } from "../../utils/normalizeContractValue";

const DEFAULT_FORM = {
  bookingId: "1",
  interfaceId: "0x80ac58cd",
  operatorAddress: "",
  ownerAddress: "",
  spotId: "1",
  tokenId: "1"
};

export function GettersTestPage() {
  const { contracts } = useContractConnection();
  const [form, setForm] = useState(DEFAULT_FORM);

  const updateField = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const runGetter = async (label, getter) => {
    if (!contracts) {
      console.error(`${label} skipped: contracts are not connected yet.`);
      return;
    }

    try {
      const result = await getter(contracts);

      console.log(label, normalizeContractValue(result));
    } catch (error) {
      console.error(`${label} failed`, error);
    }
  };

  return (
    <section>
      <h2>Getter Tests</h2>

      <div>
        <label htmlFor="spotId">Spot ID </label>
        <input id="spotId" name="spotId" value={form.spotId} onChange={updateField} />
      </div>

      <div>
        <label htmlFor="bookingId">Booking ID </label>
        <input id="bookingId" name="bookingId" value={form.bookingId} onChange={updateField} />
      </div>

      <div>
        <label htmlFor="tokenId">Token ID </label>
        <input id="tokenId" name="tokenId" value={form.tokenId} onChange={updateField} />
      </div>

      <div>
        <label htmlFor="ownerAddress">Owner Address </label>
        <input
          id="ownerAddress"
          name="ownerAddress"
          value={form.ownerAddress}
          onChange={updateField}
        />
      </div>

      <div>
        <label htmlFor="operatorAddress">Operator Address </label>
        <input
          id="operatorAddress"
          name="operatorAddress"
          value={form.operatorAddress}
          onChange={updateField}
        />
      </div>

      <div>
        <label htmlFor="interfaceId">Interface ID </label>
        <input
          id="interfaceId"
          name="interfaceId"
          value={form.interfaceId}
          onChange={updateField}
        />
      </div>

      <section>
        <h3>ParkingRegistry</h3>
        <button type="button" onClick={() => runGetter("ParkingRegistry.owner()", ({ parkingRegistry }) => getParkingRegistryOwner(parkingRegistry))}>owner()</button>
        <button type="button" onClick={() => runGetter("ParkingRegistry.paused()", ({ parkingRegistry }) => getParkingRegistryPaused(parkingRegistry))}>paused()</button>
        <button type="button" onClick={() => runGetter("ParkingRegistry.getParkingSpot()", ({ parkingRegistry }) => getParkingSpot(parkingRegistry, form.spotId))}>getParkingSpot(spotId)</button>
        <button type="button" onClick={() => runGetter("ParkingRegistry.getOwnerSpots()", ({ parkingRegistry }) => getOwnerSpots(parkingRegistry, form.ownerAddress))}>getOwnerSpots(ownerAddress)</button>
        <button type="button" onClick={() => runGetter("ParkingRegistry.getAllActiveSpots()", ({ parkingRegistry }) => getAllActiveSpots(parkingRegistry))}>getAllActiveSpots()</button>
        <button type="button" onClick={() => runGetter("ParkingRegistry.getTotalSpots()", ({ parkingRegistry }) => getTotalSpots(parkingRegistry))}>getTotalSpots()</button>
      </section>

      <section>
        <h3>BookingManager</h3>
        <button type="button" onClick={() => runGetter("BookingManager.owner()", ({ bookingManager }) => getBookingManagerOwner(bookingManager))}>owner()</button>
        <button type="button" onClick={() => runGetter("BookingManager.paused()", ({ bookingManager }) => getBookingManagerPaused(bookingManager))}>paused()</button>
        <button type="button" onClick={() => runGetter("BookingManager.registry()", ({ bookingManager }) => getRegistryAddress(bookingManager))}>registry()</button>
        <button type="button" onClick={() => runGetter("BookingManager.permitNFT()", ({ bookingManager }) => getPermitNftAddress(bookingManager))}>permitNFT()</button>
        <button type="button" onClick={() => runGetter("BookingManager.platformFeeBps()", ({ bookingManager }) => getPlatformFeeBps(bookingManager))}>platformFeeBps()</button>
        <button type="button" onClick={() => runGetter("BookingManager.accumulatedFees()", ({ bookingManager }) => getAccumulatedFees(bookingManager))}>accumulatedFees()</button>
        <button type="button" onClick={() => runGetter("BookingManager.bookings()", ({ bookingManager }) => getBooking(bookingManager, form.bookingId))}>bookings(bookingId)</button>
        <button type="button" onClick={() => runGetter("BookingManager.getSpotBookings()", ({ bookingManager }) => getSpotBookings(bookingManager, form.spotId))}>getSpotBookings(spotId)</button>
      </section>

      <section>
        <h3>ParkingPermitNFT</h3>
        <button type="button" onClick={() => runGetter("ParkingPermitNFT.owner()", ({ parkingPermitNft }) => getParkingPermitNftOwner(parkingPermitNft))}>owner()</button>
        <button type="button" onClick={() => runGetter("ParkingPermitNFT.name()", ({ parkingPermitNft }) => getParkingPermitNftName(parkingPermitNft))}>name()</button>
        <button type="button" onClick={() => runGetter("ParkingPermitNFT.symbol()", ({ parkingPermitNft }) => getParkingPermitNftSymbol(parkingPermitNft))}>symbol()</button>
        <button type="button" onClick={() => runGetter("ParkingPermitNFT.bookingManager()", ({ parkingPermitNft }) => getParkingPermitBookingManager(parkingPermitNft))}>bookingManager()</button>
        <button type="button" onClick={() => runGetter("ParkingPermitNFT.registry()", ({ parkingPermitNft }) => getParkingPermitRegistry(parkingPermitNft))}>registry()</button>
        <button type="button" onClick={() => runGetter("ParkingPermitNFT.userOf()", ({ parkingPermitNft }) => getSpotUser(parkingPermitNft, form.tokenId))}>userOf(tokenId)</button>
        <button type="button" onClick={() => runGetter("ParkingPermitNFT.userExpires()", ({ parkingPermitNft }) => getSpotUserExpires(parkingPermitNft, form.tokenId))}>userExpires(tokenId)</button>
        <button type="button" onClick={() => runGetter("ParkingPermitNFT.tokenURI()", ({ parkingPermitNft }) => getSpotTokenUri(parkingPermitNft, form.tokenId))}>tokenURI(tokenId)</button>
        <button type="button" onClick={() => runGetter("ParkingPermitNFT.ownerOf()", ({ parkingPermitNft }) => getTokenOwner(parkingPermitNft, form.tokenId))}>ownerOf(tokenId)</button>
        <button type="button" onClick={() => runGetter("ParkingPermitNFT.balanceOf()", ({ parkingPermitNft }) => getTokenBalance(parkingPermitNft, form.ownerAddress))}>balanceOf(ownerAddress)</button>
        <button type="button" onClick={() => runGetter("ParkingPermitNFT.supportsInterface()", ({ parkingPermitNft }) => getSupportsInterface(parkingPermitNft, form.interfaceId))}>supportsInterface(interfaceId)</button>
      </section>
    </section>
  );
}
