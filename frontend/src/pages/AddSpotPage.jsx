import { parseEther } from "ethers";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LocationPickerMap } from "../components/map/LocationPickerMap";
import { WalletButton } from "../components/shared/WalletButton";
import { createParkingSpot } from "../services/parkingRegistryWriteService";
import { useContractConnection } from "../state/contractConnectionContext";
import {
  getTransactionErrorMessage,
  getTransactionProgressLabel
} from "../utils/transactionErrors";
import { shortenHash } from "../utils/formatters";

const DEFAULT_FORM = {
  capacity: "1",
  description: "",
  latitude: "48.14860",
  locationName: "",
  longitude: "17.10770",
  priceEth: "0.001"
};

function coordinateToE6(value, fieldName) {
  if (value === "") {
    throw new Error(`${fieldName} is required.`);
  }

  const coordinate = Number(value);

  if (!Number.isFinite(coordinate)) {
    throw new Error(`${fieldName} must be a valid coordinate.`);
  }

  return Math.round(coordinate * 1_000_000).toString();
}

function previewCoordinateToE6(value) {
  if (!value || !Number.isFinite(Number(value))) {
    return "-";
  }

  return Math.round(Number(value) * 1_000_000).toString();
}

function validatePositiveInteger(value, fieldName) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw new Error(`${fieldName} must be a whole number greater than 0.`);
  }
}

function validatePositiveNumber(value, fieldName) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`${fieldName} must be greater than 0.`);
  }
}

export function AddSpotPage() {
  const navigate = useNavigate();
  const { account, balance, chainId, connect, contracts } = useContractConnection();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [hasPickedLocation, setHasPickedLocation] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [transactionHash, setTransactionHash] = useState("");
  const [error, setError] = useState(null);

  const updateField = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setTransactionHash("");

    if (!contracts) {
      setStatus("Connect wallet first");
      return;
    }

    setStatus("Submitting...");

    try {
      validatePositiveInteger(form.capacity, "Vehicle capacity");
      validatePositiveNumber(form.priceEth, "Hourly price");

      const payload = {
        capacity: form.capacity,
        description: form.description,
        latitudeE6: coordinateToE6(form.latitude, "Latitude"),
        locationName: form.locationName,
        longitudeE6: coordinateToE6(form.longitude, "Longitude"),
        pricePerHour: parseEther(form.priceEth || "0").toString()
      };

      await createParkingSpot(contracts.parkingRegistry, payload, {
        onStatus: (update) => {
          setStatus(getTransactionProgressLabel(update));
          if (update.hash) {
            setTransactionHash(update.hash);
          }
        }
      });

      setStatus("Success");
      navigate("/");
    } catch (nextError) {
      console.error("Add spot failed", nextError);
      setError(new Error(getTransactionErrorMessage(nextError, "Could not create spot.")));
      setStatus("Failed");
    }
  };

  const applyPickedLocation = ({ latitude, longitude }) => {
    setForm((current) => ({
      ...current,
      latitude,
      longitude
    }));
    setHasPickedLocation(true);
    setIsLocationPickerOpen(false);
  };

  return (
    <div className="app-root">
      <header className="topbar">
        <Link className="brand" to="/">
          ParkFi
        </Link>

        <div className="topbar-note" aria-hidden="true">
          Add a parking location to the map
        </div>

        <Link className="button-secondary" to="/">
          Map
        </Link>

        <Link className="button-ghost" to="/profile">
          Profile
        </Link>

        <WalletButton account={account} balance={balance} chainId={chainId} connect={connect} />
      </header>

      {isLocationPickerOpen ? (
        <LocationPickerMap
          initialLatitude={form.latitude}
          initialLongitude={form.longitude}
          onApply={applyPickedLocation}
          onClose={() => setIsLocationPickerOpen(false)}
        />
      ) : null}

      <main className="content-page">
        <div className="content-shell">
          <div>
            <p className="eyebrow">New listing</p>
            <h1 className="page-title">Add parking spot</h1>
            <p className="muted">
              Create a map listing with its location, vehicle capacity, and hourly price.
            </p>
          </div>

          <section className="form-grid">
            <form className="form-panel" onSubmit={submit}>
              <div className="field-grid">
                <div className="field full">
                  <label htmlFor="locationName">Location name</label>
                  <input
                    className="form-input"
                    id="locationName"
                    name="locationName"
                    placeholder="Garage near main station"
                    required
                    value={form.locationName}
                    onChange={updateField}
                  />
                </div>

                <div className="field full">
                  <label htmlFor="description">Description</label>
                  <textarea
                    className="form-textarea"
                    id="description"
                    name="description"
                    placeholder="Access notes, entrance, floor, or restrictions"
                    value={form.description}
                    onChange={updateField}
                  />
                </div>

                <div className="field full">
                  <label>Location</label>
                  <div className="location-picker-summary">
                    <span>
                      Selected location: {Number(form.latitude).toFixed(6)},{" "}
                      {Number(form.longitude).toFixed(6)}
                    </span>
                    <button
                      className="button-secondary"
                      type="button"
                      onClick={() => setIsLocationPickerOpen(true)}
                    >
                      {hasPickedLocation ? "Change location" : "Pick on map"}
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="priceEth">Price per hour (ETH)</label>
                  <input
                    className="form-input"
                    id="priceEth"
                    min="0.000001"
                    name="priceEth"
                    required
                    step="0.000001"
                    type="number"
                    value={form.priceEth}
                    onChange={updateField}
                  />
                </div>

                <div className="field">
                  <label htmlFor="capacity">Vehicle capacity</label>
                  <input
                    className="form-input"
                    id="capacity"
                    min="1"
                    name="capacity"
                    required
                    step="1"
                    type="number"
                    value={form.capacity}
                    onChange={updateField}
                  />
                </div>
              </div>

              <button
                className="button"
                disabled={["Confirm in MetaMask", "Transaction sent", "Submitting..."].includes(status)}
                type="submit"
              >
                {["Confirm in MetaMask", "Transaction sent", "Submitting..."].includes(status)
                  ? "Creating..."
                  : "Create Spot"}
              </button>

              {transactionHash ? (
                <p className="notice">Transaction: {shortenHash(transactionHash)}</p>
              ) : null}
              {error ? <p className="notice">{error.message}</p> : null}
            </form>

            <aside className="form-panel">
              <p className="eyebrow">Preview</p>
              <h2 className="panel-title">
                {form.locationName || "Unnamed parking spot"}
              </h2>
              <div className="detail-list">
                <div className="detail-row">
                  <span className="muted">Hourly price</span>
                  <strong>{form.priceEth || "0"} ETH</strong>
                </div>
                <div className="detail-row">
                  <span className="muted">Vehicle capacity</span>
                  <strong>{form.capacity || "0"}</strong>
                </div>
                <div className="detail-row">
                  <span className="muted">Latitude</span>
                  <strong>{Number(form.latitude).toFixed(6)}</strong>
                </div>
                <div className="detail-row">
                  <span className="muted">Longitude</span>
                  <strong>{Number(form.longitude).toFixed(6)}</strong>
                </div>
                <div className="detail-row">
                  <span className="muted">Latitude E6</span>
                  <strong>{previewCoordinateToE6(form.latitude)}</strong>
                </div>
                <div className="detail-row">
                  <span className="muted">Longitude E6</span>
                  <strong>{previewCoordinateToE6(form.longitude)}</strong>
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
