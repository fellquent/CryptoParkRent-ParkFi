import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { bookSpot } from "../services/bookingManagerWriteService";
import { getParkingSpot } from "../services/parkingRegistryReadService";
import { useContractConnection } from "../state/contractConnectionContext";
import { formatEthAmount, formatPricePerHour, shortenAddress } from "../utils/formatters";

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
    isAvailable: rawSpot.isAvailable ?? rawSpot[7],
    locationName: rawSpot.locationName ?? rawSpot[2],
    owner: rawSpot.owner ?? rawSpot[1],
    pricePerHour
  };
}

function getBookingErrorMessage(error) {
  const reason = error?.reason || error?.revert?.args?.[0] || error?.shortMessage;

  if (reason) {
    return reason;
  }

  return "Booking failed. Please check the selected time and try again.";
}

export function BookingPage() {
  const navigate = useNavigate();
  const { spotId } = useParams();
  const { account, connect, contracts } = useContractConnection();
  const [spot, setSpot] = useState(null);
  const [startAt, setStartAt] = useState(() => toDateTimeLocal(new Date(Date.now() + 60000)));
  const [durationHours, setDurationHours] = useState("1");
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState(null);

  const bookingTimes = useMemo(() => {
    const startTime = Math.floor(new Date(startAt).getTime() / 1000);
    const hours = Math.max(1, Math.floor(Number(durationHours) || 1));
    const endTime = startTime + hours * 60 * 60;
    const durationHoursForContract = Math.floor((endTime - startTime) / 3600);

    return {
      durationHours: durationHoursForContract,
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
        const nextSpot = normalizeSpot(
          await getParkingSpot(contracts.parkingRegistry, spotId)
        );

        if (active) {
          setSpot(nextSpot);
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
    if (!spot || !durationHours) {
      return 0n;
    }

    return BigInt(bookingTimes.durationHours) * BigInt(spot.pricePerHour);
  }, [bookingTimes.durationHours, durationHours, spot]);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);

    if (!contracts || !spot) {
      setStatus("Connect wallet first");
      return;
    }

    setStatus("Submitting...");

    try {
      await bookSpot(contracts.bookingManager, {
        endTime: bookingTimes.endTime,
        spotId: spot.id,
        startTime: bookingTimes.startTime,
        totalPrice
      });

      setStatus("Success");
      navigate("/profile");
    } catch (nextError) {
      console.error("Booking failed", nextError);
      setError(new Error(getBookingErrorMessage(nextError)));
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
        <button className="button" type="button" onClick={connect}>
          {account ? shortenAddress(account) : "Connect Wallet"}
        </button>
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

              <button className="button" disabled={status === "Submitting..."} type="submit">
                {status === "Submitting..." ? "Booking..." : "Confirm Booking"}
              </button>

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
                  <span className="muted">Capacity</span>
                  <strong>{spot?.capacity?.toString() || "-"}</strong>
                </div>
              </div>
              <p className="notice">Status: {status}</p>
            </aside>
          </section>
        </div>
      </main>
    </div>
  );
}
