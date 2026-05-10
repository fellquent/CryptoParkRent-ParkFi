import { parseEther } from "ethers";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  loadBookingsForOwnedSpots,
  loadOwnerSpots,
  loadRenterBookings,
  splitBookingsByTime
} from "../services/profileService";
import {
  setSpotAvailability,
  updateParkingSpot
} from "../services/parkingRegistryWriteService";
import { useContractConnection } from "../state/contractConnectionContext";
import { shortenAddress } from "../utils/formatters";

function BookingList({ bookings, emptyText }) {
  if (!bookings.length) {
    return <p className="notice">{emptyText}</p>;
  }

  return (
    <div className="stack-list">
      {bookings.map((booking) => (
        <article className="list-card" key={booking.id.toString()}>
          <div>
            <p className="eyebrow">{booking.statusLabel}</p>
            <h3 className="panel-title">
              {booking.spot?.locationName || `Spot #${booking.spotId.toString()}`}
            </h3>
            <p className="muted">{booking.timeLabel}</p>
          </div>
          <strong>{booking.totalPriceLabel}</strong>
        </article>
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

  return (
    <form className="list-card spot-edit-card" onSubmit={submit}>
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
        const spots = await loadOwnerSpots(contracts, account);
        const [renterBookings, ownerBookings] = await Promise.all([
          loadRenterBookings(contracts, account),
          loadBookingsForOwnedSpots(contracts, spots)
        ]);

        if (active) {
          setOwnedSpots(spots);
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
        <button className="button" type="button" onClick={connect}>
          {account ? "Connected" : "Connect Wallet"}
        </button>
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
                  emptyText="No current bookings yet."
                />
              </div>
              <div className="form-panel">
                <p className="eyebrow">History</p>
                <h2 className="panel-title">Past bookings</h2>
                <BookingList
                  bookings={splitBookings.history}
                  emptyText="No booking history found yet."
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
                  emptyText="No one has booked your spots yet."
                />
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
