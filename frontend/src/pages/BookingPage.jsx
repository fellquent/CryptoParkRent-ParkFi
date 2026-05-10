import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { WalletButton } from "../components/shared/WalletButton";
import { bookSpot } from "../services/bookingManagerWriteService";
import { getBooking, getSpotBookings } from "../services/bookingManagerReadService";
import { getParkingSpot } from "../services/parkingRegistryReadService";
import { useContractConnection } from "../state/contractConnectionContext";
import {
  formatEthAmount,
  formatPricePerHour,
  shortenAddress,
  shortenHash
} from "../utils/formatters";
import {
  getTransactionErrorMessage,
  getTransactionProgressLabel
} from "../utils/transactionErrors";

const DEFAULT_START_DELAY_MS = 10 * 60 * 1000;
const BOOKING_STATUS_LABELS = ["Reserved", "Active", "Completed", "Cancelled"];

function toDateTimeLocal(date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);

  return offsetDate.toISOString().slice(0, 16);
}

function normalizeSpot(rawSpot) {
  const pricePerHour = rawSpot.pricePerHour ?? rawSpot[6];

  return {
    capacity: rawSpot.capacity ?? rawSpot[8],
    description: rawSpot.description ?? rawSpot[3],
    displayPrice: formatPricePerHour(pricePerHour),
    id: rawSpot.id ?? rawSpot[0],
    isActive: rawSpot.isActive ?? rawSpot[9],
    isAvailable: rawSpot.isAvailable ?? rawSpot[7],
    locationName: rawSpot.locationName ?? rawSpot[2],
    owner: rawSpot.owner ?? rawSpot[1],
    pricePerHour
  };
}

function formatDateTimeFromSeconds(value) {
  return new Date(Number(value) * 1000).toLocaleString();
}

function formatBookingWindow(booking) {
  return `${formatDateTimeFromSeconds(booking.startTime)} - ${formatDateTimeFromSeconds(booking.endTime)}`;
}

export function BookingPage() {
  const navigate = useNavigate();
  const { spotId } = useParams();
  const { account, balance, chainId, connect, contracts } = useContractConnection();
  const [spot, setSpot] = useState(null);
  const [spotBookings, setSpotBookings] = useState([]);
  const [startAt, setStartAt] = useState(() =>
    toDateTimeLocal(new Date(Date.now() + DEFAULT_START_DELAY_MS))
  );
  const [durationHours, setDurationHours] = useState("1");
  const [status, setStatus] = useState("Idle");
  const [transactionHash, setTransactionHash] = useState("");
  const [error, setError] = useState(null);

  const bookingTimes = useMemo(() => {
    const startMs = new Date(startAt).getTime();
    const startTime = Number.isFinite(startMs) ? Math.floor(startMs / 1000) : NaN;
    const parsedHours = Number(durationHours);
    const hours =
      Number.isInteger(parsedHours) && parsedHours > 0 ? parsedHours : 0;
    const endTime = Number.isFinite(startTime) ? startTime + hours * 60 * 60 : NaN;

    return {
      durationHours: hours,
      endTime,
      startTime
    };
  }, [durationHours, startAt]);

  useEffect(() => {
    if (!contracts || !spotId) {
      return;
    }

    let active = true;

    const load = async () => {
      try {
        const [nextSpot, bookingIds] = await Promise.all([
          getParkingSpot(contracts.parkingRegistry, spotId),
          getSpotBookings(contracts.bookingManager, spotId)
        ]);
        const nextBookings = await Promise.all(
          bookingIds.map((bookingId) => getBooking(contracts.bookingManager, bookingId))
        );

        if (active) {
          setSpot(normalizeSpot(nextSpot));
          setSpotBookings(
            nextBookings.map((booking) => ({
              endTime: booking.endTime ?? booking[5],
              startTime: booking.startTime ?? booking[4],
              status: Number(booking.status ?? booking[8])
            }))
          );
        }
      } catch (nextError) {
        console.error("Failed to load booking spot", nextError);
        if (active) {
          setError(nextError);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [contracts, spotId]);

  const totalPrice = useMemo(() => {
    if (!spot || bookingTimes.durationHours < 1) {
      return 0n;
    }

    return BigInt(bookingTimes.durationHours) * BigInt(spot.pricePerHour);
  }, [bookingTimes.durationHours, spot]);

  const blockedWindows = useMemo(
    () =>
      spotBookings
        .filter((booking) => booking.status === 0 || booking.status === 1)
        .sort((a, b) => Number(a.startTime) - Number(b.startTime)),
    [spotBookings]
  );

  const timeSlotUnavailable = useMemo(() => {
    return blockedWindows.some((booking) => {
      return (
        bookingTimes.startTime < Number(booking.endTime) &&
        bookingTimes.endTime > Number(booking.startTime)
      );
    });
  }, [blockedWindows, bookingTimes.endTime, bookingTimes.startTime]);

  const timeInputError = useMemo(() => {
    if (!Number.isFinite(bookingTimes.startTime)) {
      return "Choose a valid start time.";
    }

    if (bookingTimes.durationHours < 1) {
      return "Duration must be a whole number of hours.";
    }

    if (bookingTimes.startTime < Math.floor(Date.now() / 1000)) {
      return "Choose a start time in the future.";
    }

    return null;
  }, [bookingTimes.durationHours, bookingTimes.startTime]);

  const spotUnavailable = Boolean(spot && (!spot.isActive || !spot.isAvailable));
  const canSubmit =
    Boolean(contracts && spot) &&
    !timeInputError &&
    !spotUnavailable &&
    !timeSlotUnavailable &&
    !["Confirm in MetaMask", "Transaction sent", "Submitting..."].includes(status);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setTransactionHash("");

    if (!contracts || !spot) {
      setStatus("Connect wallet first");
      return;
    }

    if (timeInputError) {
      setError(new Error(timeInputError));
      setStatus("Invalid time");
      return;
    }

    if (spotUnavailable) {
      setError(new Error("This spot is not currently available for booking."));
      setStatus("Unavailable");
      return;
    }

    if (timeSlotUnavailable) {
      setError(new Error("This time overlaps an existing booking."));
      setStatus("Unavailable");
      return;
    }

    setStatus("Submitting...");

    try {
      await bookSpot(contracts.bookingManager, {
        endTime: bookingTimes.endTime,
        spotId: spot.id,
        startTime: bookingTimes.startTime,
        totalPrice
      }, {
        onStatus: (update) => {
          setStatus(getTransactionProgressLabel(update));
          if (update.hash) {
            setTransactionHash(update.hash);
          }
        }
      });

      setStatus("Success");
      navigate("/profile");
    } catch (nextError) {
      console.error("Booking failed", nextError);
      setError(
        new Error(
          getTransactionErrorMessage(
            nextError,
            "Booking failed. Please check the selected time and try again."
          )
        )
      );
      setStatus("Failed");
    }
  };

  return (
    <div className="app-root">
      <header className="topbar">
        <Link className="brand" to="/">
          ParkFi
        </Link>
        <div className="topbar-note">Reserve a parking spot</div>
        <Link className="button-secondary" to="/profile">
          Profile
        </Link>
        <Link className="button-secondary" to="/add-spot">
          Add Spot
        </Link>
        <WalletButton account={account} balance={balance} chainId={chainId} connect={connect} />
      </header>

      <main className="content-page">
        <div className="content-shell">
          <div>
            <p className="eyebrow">Booking</p>
            <h1 className="page-title">{spot?.locationName || "Parking spot"}</h1>
            <p className="muted">
              {spot?.description || "Choose your time and confirm the booking."}
            </p>
          </div>

          <section className="form-grid">
            <form className="form-panel" onSubmit={submit}>
              <div className="field-grid">
                <div className="field full">
                  <label htmlFor="startAt">Start time</label>
                  <input
                    className="form-input"
                    id="startAt"
                    min={toDateTimeLocal(new Date())}
                    required
                    type="datetime-local"
                    value={startAt}
                    onChange={(event) => setStartAt(event.target.value)}
                  />
                </div>

                <div className="field full">
                  <label htmlFor="durationHours">Duration hours</label>
                  <input
                    className="form-input"
                    id="durationHours"
                    min="1"
                    required
                    step="1"
                    type="number"
                    value={durationHours}
                    onChange={(event) => setDurationHours(event.target.value)}
                  />
                </div>
              </div>

              <button className="button" disabled={!canSubmit} type="submit">
                {status === "Submitting..." ? "Booking..." : "Confirm Booking"}
              </button>

              {spotUnavailable ? (
                <p className="notice">This spot is unavailable.</p>
              ) : null}
              {timeInputError ? (
                <p className="notice">{timeInputError}</p>
              ) : null}
              {timeSlotUnavailable ? (
                <p className="notice">This time overlaps an existing booking.</p>
              ) : null}
              {transactionHash ? (
                <p className="notice">Transaction: {shortenHash(transactionHash)}</p>
              ) : null}
              {error ? <p className="notice">{error.message}</p> : null}
            </form>

            <aside className="form-panel">
              <p className="eyebrow">Summary</p>
              <h2 className="panel-title">{spot?.displayPrice || "Loading price..."}</h2>
              <div className="detail-list">
                <div className="detail-row">
                  <span className="muted">Total</span>
                  <strong>{formatEthAmount(totalPrice)}</strong>
                </div>
                <div className="detail-row">
                  <span className="muted">Owner</span>
                  <strong>{shortenAddress(spot?.owner)}</strong>
                </div>
                <div className="detail-row">
                  <span className="muted">Vehicle capacity</span>
                  <strong>{spot?.capacity?.toString() || "-"}</strong>
                </div>
                <div className="detail-row">
                  <span className="muted">Booking status</span>
                  <strong>
                    {spotUnavailable
                      ? "Unavailable"
                      : timeSlotUnavailable
                        ? "Time conflict"
                        : "Available"}
                  </strong>
                </div>
              </div>
              <p className="notice">Status: {status}</p>
            </aside>

            <aside className="form-panel booking-windows-panel">
              <p className="eyebrow">Unavailable windows</p>
              <h2 className="panel-title">Existing bookings</h2>
              {blockedWindows.length ? (
                <div className="stack-list">
                  {blockedWindows.slice(0, 6).map((booking) => (
                    <div className="booking-window" key={`${booking.startTime}-${booking.endTime}`}>
                      <strong>{BOOKING_STATUS_LABELS[booking.status] || "Booked"}</strong>
                      <span className="muted">{formatBookingWindow(booking)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="notice">No reserved or active bookings for this spot.</p>
              )}
            </aside>
          </section>
        </div>
      </main>
    </div>
  );
}
