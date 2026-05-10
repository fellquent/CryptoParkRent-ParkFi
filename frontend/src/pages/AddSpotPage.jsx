import { parseEther } from "ethers";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createParkingSpot } from "../services/parkingRegistryWriteService";
import { useContractConnection } from "../state/contractConnectionContext";
import { shortenAddress } from "../utils/formatters";

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

export function AddSpotPage() {
  const navigate = useNavigate();
  const { account, connect, contracts } = useContractConnection();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [status, setStatus] = useState("Idle");
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

    if (!contracts) {
      setStatus("Connect wallet first");
      return;
    }

    setStatus("Submitting...");

    try {
      const payload = {
        capacity: form.capacity,
        description: form.description,
        latitudeE6: coordinateToE6(form.latitude, "Latitude"),
        locationName: form.locationName,
        longitudeE6: coordinateToE6(form.longitude, "Longitude"),
        pricePerHour: parseEther(form.priceEth || "0").toString()
      };

      await createParkingSpot(contracts.parkingRegistry, payload);

      setStatus("Success");
      navigate("/");
    } catch (nextError) {
      console.error("Add spot failed", nextError);
      setError(nextError);
      setStatus("Failed");
    }
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

        <button className="button" type="button" onClick={connect}>
          {account ? shortenAddress(account) : "Connect Wallet"}
        </button>
      </header>

      <main className="content-page">
        <div className="content-shell">
          <div>
            <p className="eyebrow">New listing</p>
            <h1 className="page-title">Add parking spot</h1>
            <p className="muted">
              Create a map listing with its coordinates, capacity, and hourly price.
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

                <div className="field">
                  <label htmlFor="latitude">Latitude</label>
                  <input
                    className="form-input"
                    id="latitude"
                    name="latitude"
                    required
                    type="number"
                    step="0.000001"
                    value={form.latitude}
                    onChange={updateField}
                  />
                </div>

                <div className="field">
                  <label htmlFor="longitude">Longitude</label>
                  <input
                    className="form-input"
                    id="longitude"
                    name="longitude"
                    required
                    type="number"
                    step="0.000001"
                    value={form.longitude}
                    onChange={updateField}
                  />
                </div>

                <div className="field">
                  <label htmlFor="priceEth">Price per hour (ETH)</label>
                  <input
                    className="form-input"
                    id="priceEth"
                    min="0"
                    name="priceEth"
                    required
                    step="0.000001"
                    type="number"
                    value={form.priceEth}
                    onChange={updateField}
                  />
                </div>

                <div className="field">
                  <label htmlFor="capacity">Capacity</label>
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

              <button className="button" disabled={status === "Submitting..."} type="submit">
                {status === "Submitting..." ? "Creating..." : "Create Spot"}
              </button>

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
                  <span className="muted">Capacity</span>
                  <strong>{form.capacity || "0"}</strong>
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
