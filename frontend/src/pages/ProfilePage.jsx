import { parseEther } from "ethers";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { WalletButton } from "../components/shared/WalletButton";
import {
  loadBookingsForOwnedSpots,
  loadOwnerSpots,
  loadRenterBookings,
  splitBookingsByTime
} from "../services/profileService";
import {
  cancelBooking,
  releasePayment
} from "../services/bookingManagerWriteService";
import {
  deactivateParkingSpot,
  setSpotAvailability,
  updateParkingSpot
} from "../services/parkingRegistryWriteService";
import { useContractConnection } from "../state/contractConnectionContext";
import { shortenAddress } from "../utils/formatters";

function getActionErrorMessage(error) {
  return error?.reason || error?.revert?.args?.[0] || error?.shortMessage || error?.message || "Transaction failed.";
}

function BookingCard({ booking, contracts, mode, onUpdated }) {
  const [status, setStatus] = useState("Idle");
  const now = Math.floor(Date.now() / 1000);
  const isReserved = booking.status === 0;
  const isActive = booking.status === 1;
  const hasStarted = Number(booking.startTime) <= now;
  const canCancel = mode === "renter" && isReserved && !hasStarted;
  const canShowRedeem = mode === "owner" && (isReserved || isActive) && hasStarted;

  const runCancel = async () => {
    setStatus("Cancelling...");

    try {
      await cancelBooking(contracts.bookingManager, booking.id);
      setStatus("Cancelled");
      onUpdated();
    } catch (error) {
      console.error("Booking cancel failed", error);
      setStatus(getActionErrorMessage(error));
    }
  };

  const runReleasePayment = async () => {
    setStatus("Redeeming...");

    try {
      await releasePayment(contracts.bookingManager, booking.id);
      setStatus("Redeemed");
      onUpdated();
    } catch (error) {
      console.error("Payment release failed", error);
      setStatus(getActionErrorMessage(error));
    }
  };

  return (
    <article className="list-card booking-card">
      {canCancel ? (
        <button
          aria-label="Cancel booking"
          className="icon-button danger booking-card-action"
          title="Cancel booking"
          type="button"
          onClick={runCancel}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="#991b1b" d="M262.2 48C248.9 48 236.9 56.3 232.2 68.8L216 112L120 112C106.7 112 96 122.7 96 136C96 149.3 106.7 160 120 160L520 160C533.3 160 544 149.3 544 136C544 122.7 533.3 112 520 112L424 112L407.8 68.8C403.1 56.3 391.2 48 377.8 48L262.2 48zM128 208L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 208L464 208L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 208L128 208zM288 280C288 266.7 277.3 256 264 256C250.7 256 240 266.7 240 280L240 456C240 469.3 250.7 480 264 480C277.3 480 288 469.3 288 456L288 280zM400 280C400 266.7 389.3 256 376 256C362.7 256 352 266.7 352 280L352 456C352 469.3 362.7 480 376 480C389.3 480 400 469.3 400 456L400 280z" /></svg>        </button>
      ) : null}

      <div>
        <p className="eyebrow">{booking.statusLabel}</p>
        <h3 className="panel-title">
          {booking.spot?.locationName || `Spot #${booking.spotId.toString()}`}
        </h3>
        <p className="muted">{booking.timeLabel}</p>
      </div>

      <div className="booking-card-footer">
        <strong>{booking.totalPriceLabel}</strong>
        {canShowRedeem ? (
          <button
            className="button success-button"
            disabled={status === "Redeeming..."}
            title="Redeem payment"
            type="button"
            onClick={runReleasePayment}
          >
            {status === "Redeeming..." ? "Redeeming..." : "Redeem payment"}
          </button>
        ) : null}
      </div>

      {status !== "Idle" ? <p className="notice compact">Status: {status}</p> : null}
    </article>
  );
}

function BookingList({ bookings, contracts, emptyText, mode, onUpdated }) {
  if (!bookings.length) {
    return <p className="notice">{emptyText}</p>;
  }

  return (
    <div className="stack-list">
      {bookings.map((booking) => (
        <BookingCard
          booking={booking}
          contracts={contracts}
          key={booking.id.toString()}
          mode={mode}
          onUpdated={onUpdated}
        />
      ))}
    </div>
  );
}

function SpotEditor({ contracts, spot, onUpdated }) {
  const [form, setForm] = useState({
    capacity: spot.capacity.toString(),
    description: spot.description || "",
    locationName: spot.locationName || "",
    priceEth: spot.displayPrice.split(" ")[0]
  });
  const [status, setStatus] = useState("Idle");

  const updateField = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setStatus("Saving...");

    try {
      await updateParkingSpot(contracts.parkingRegistry, spot.id, {
        capacity: form.capacity,
        description: form.description,
        locationName: form.locationName,
        pricePerHour: parseEther(form.priceEth || "0").toString()
      });
      setStatus("Saved");
      onUpdated();
    } catch (error) {
      console.error("Spot update failed", error);
      setStatus("Failed");
    }
  };

  const toggleAvailability = async () => {
    setStatus("Saving...");

    try {
      await setSpotAvailability(contracts.parkingRegistry, spot.id, !spot.isAvailable);
      setStatus("Saved");
      onUpdated();
    } catch (error) {
      console.error("Availability update failed", error);
      setStatus("Failed");
    }
  };

  const deactivateSpot = async () => {
    if (!window.confirm("Are you sure?")) {
      return;
    }

    setStatus("Deactivating...");

    try {
      await deactivateParkingSpot(contracts.parkingRegistry, spot.id);
      setStatus("Deactivated");
      onUpdated();
    } catch (error) {
      console.error("Spot deactivation failed", error);
      setStatus(getActionErrorMessage(error));
    }
  };

  return (
    <form className="list-card spot-edit-card" onSubmit={submit}>
      <button
        aria-label="Deactivate spot"
        className="button-secondary danger-button spot-card-action"
        type="button"
        onClick={deactivateSpot}
      >
        Deactivate
      </button>

      <div className="field-grid">
        <div className="field">
          <label htmlFor={`name-${spot.id.toString()}`}>Name</label>
          <input
            className="form-input"
            id={`name-${spot.id.toString()}`}
            name="locationName"
            value={form.locationName}
            onChange={updateField}
          />
        </div>

        <div className="field">
          <label htmlFor={`price-${spot.id.toString()}`}>Price ETH / hour</label>
          <input
            className="form-input"
            id={`price-${spot.id.toString()}`}
            min="0"
            name="priceEth"
            step="0.000001"
            type="number"
            value={form.priceEth}
            onChange={updateField}
          />
        </div>

        <div className="field">
          <label htmlFor={`capacity-${spot.id.toString()}`}>Capacity</label>
          <input
            className="form-input"
            id={`capacity-${spot.id.toString()}`}
            min="1"
            name="capacity"
            step="1"
            type="number"
            value={form.capacity}
            onChange={updateField}
          />
        </div>

        <div className="field">
          <label>Availability</label>
          <button className="button-secondary" type="button" onClick={toggleAvailability}>
            {spot.isAvailable ? "Mark Unavailable" : "Mark Available"}
          </button>
        </div>

        <div className="field full">
          <label htmlFor={`description-${spot.id.toString()}`}>Description</label>
          <textarea
            className="form-textarea"
            id={`description-${spot.id.toString()}`}
            name="description"
            value={form.description}
            onChange={updateField}
          />
        </div>
      </div>

      <div className="inline-actions">
        <button className="button" type="submit">
          Save Spot
        </button>
        <span className="muted">Status: {status}</span>
      </div>
    </form>
  );
}

export function ProfilePage() {
  const { account, connect, contracts } = useContractConnection();
  const [activeTab, setActiveTab] = useState("bookings");
  const [isLoading, setIsLoading] = useState(false);
  const [myBookings, setMyBookings] = useState([]);
  const [ownedSpotBookings, setOwnedSpotBookings] = useState([]);
  const [ownedSpots, setOwnedSpots] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!contracts || !account) {
      return;
    }

    let active = true;

    const load = async () => {
      setIsLoading(true);

      try {
        const allOwnerSpots = await loadOwnerSpots(contracts, account);
        const activeOwnerSpots = allOwnerSpots.filter((spot) => spot.isActive);
        const [renterBookings, ownerBookings] = await Promise.all([
          loadRenterBookings(contracts, account),
          loadBookingsForOwnedSpots(contracts, allOwnerSpots)
        ]);

        if (active) {
          setOwnedSpots(activeOwnerSpots);
          setMyBookings(renterBookings);
          setOwnedSpotBookings(ownerBookings);
        }
      } catch (error) {
        console.error("Profile load failed", error);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [account, contracts, reloadKey]);

  const splitBookings = useMemo(
    () => splitBookingsByTime(myBookings),
    [myBookings]
  );

  return (
    <div className="app-root">
      <header className="topbar">
        <Link className="brand" to="/">
          ParkFi
        </Link>
        <div className="topbar-note">
          {account ? shortenAddress(account) : "Connect wallet to load profile"}
        </div>
        <Link className="button-secondary" to="/">
          Map
        </Link>
        <Link className="button-secondary" to="/add-spot">
          Add Spot
        </Link>
        <WalletButton account={account} connect={connect} />
      </header>

      <main className="content-page">
        <div className="content-shell">
          <div>
            <p className="eyebrow">Profile</p>
            <h1 className="page-title">Your parking dashboard</h1>
            <p className="muted">
              {isLoading ? "Refreshing profile..." : "Manage bookings and your spots."}
            </p>
          </div>

          <div className="tabs">
            <button
              className={`tab-button${activeTab === "bookings" ? " is-active" : ""}`}
              type="button"
              onClick={() => setActiveTab("bookings")}
            >
              Bookings
            </button>
            <button
              className={`tab-button${activeTab === "spots" ? " is-active" : ""}`}
              type="button"
              onClick={() => setActiveTab("spots")}
            >
              Spots
            </button>
          </div>

          {activeTab === "bookings" ? (
            <section className="profile-grid">
              <div className="form-panel">
                <p className="eyebrow">Now</p>
                <h2 className="panel-title">My bookings</h2>
                <BookingList
                  bookings={splitBookings.current}
                  contracts={contracts}
                  emptyText="No current bookings yet."
                  mode="renter"
                  onUpdated={() => setReloadKey((current) => current + 1)}
                />
              </div>
              <div className="form-panel">
                <p className="eyebrow">History</p>
                <h2 className="panel-title">Past bookings</h2>
                <BookingList
                  bookings={splitBookings.history}
                  contracts={contracts}
                  emptyText="No booking history found yet."
                  mode="renter"
                  onUpdated={() => setReloadKey((current) => current + 1)}
                />
              </div>
            </section>
          ) : (
            <section className="profile-grid">
              <div className="form-panel">
                <p className="eyebrow">Owned spots</p>
                <h2 className="panel-title">Edit spot</h2>
                <div className="stack-list">
                  {ownedSpots.length ? (
                    ownedSpots.map((spot) => (
                      <SpotEditor
                        contracts={contracts}
                        key={spot.id.toString()}
                        spot={spot}
                        onUpdated={() => setReloadKey((current) => current + 1)}
                      />
                    ))
                  ) : (
                    <p className="notice">No owned spots yet.</p>
                  )}
                </div>
              </div>
              <div className="form-panel">
                <p className="eyebrow">Spot bookings</p>
                <h2 className="panel-title">Bookings on my spots</h2>
                <BookingList
                  bookings={ownedSpotBookings}
                  contracts={contracts}
                  emptyText="No one has booked your spots yet."
                  mode="owner"
                  onUpdated={() => setReloadKey((current) => current + 1)}
                />
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
