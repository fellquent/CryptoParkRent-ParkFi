import { useState } from "react";
import { useContractConnection } from "../../state/contractConnectionContext";
import { createParkingSpot } from "../../services/parkingRegistryWriteService";
import { normalizeContractValue } from "../../utils/normalizeContractValue";
import { VEHICLE_SIZE_OPTIONS } from "../../utils/vehicleSizes";

const DEFAULT_FORM = {
  description: "",
  latitudeE6: "48500000",
  locationName: "",
  longitudeE6: "17100000",
  pricePerHour: "1000000000000000",
  vehicleSize: "2"
};

export function CreateSpotTestPage() {
  const { contracts } = useContractConnection();
  const [form, setForm] = useState(DEFAULT_FORM);
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

    if (!contracts) {
      console.error("createParkingSpot skipped: contracts are not connected yet.");
      return;
    }

    setStatus("Submitting...");

    try {
      console.log("ParkingRegistry.createParkingSpot() payload", form);

      const result = await createParkingSpot(contracts.parkingRegistry, form);

      console.log(
        "ParkingRegistry.createParkingSpot() success",
        normalizeContractValue(result)
      );

      setStatus("Success");
    } catch (error) {
      console.error("ParkingRegistry.createParkingSpot() failed", error);
      setStatus("Failed");
    }
  };

  return (
    <section>
      <h2>Create Spot Test</h2>
      <form onSubmit={submit}>
        <div>
          <label htmlFor="locationName">Location Name </label>
          <input
            id="locationName"
            name="locationName"
            value={form.locationName}
            onChange={updateField}
          />
        </div>

        <div>
          <label htmlFor="description">Description </label>
          <input
            id="description"
            name="description"
            value={form.description}
            onChange={updateField}
          />
        </div>

        <div>
          <label htmlFor="latitudeE6">Latitude E6 </label>
          <input
            id="latitudeE6"
            name="latitudeE6"
            value={form.latitudeE6}
            onChange={updateField}
          />
        </div>

        <div>
          <label htmlFor="longitudeE6">Longitude E6 </label>
          <input
            id="longitudeE6"
            name="longitudeE6"
            value={form.longitudeE6}
            onChange={updateField}
          />
        </div>

        <div>
          <label htmlFor="pricePerHour">Price Per Hour (wei) </label>
          <input
            id="pricePerHour"
            name="pricePerHour"
            value={form.pricePerHour}
            onChange={updateField}
          />
        </div>

        <div>
          <label htmlFor="vehicleSize">Vehicle type </label>
          <select
            id="vehicleSize"
            name="vehicleSize"
            value={form.vehicleSize}
            onChange={updateField}
          >
            {VEHICLE_SIZE_OPTIONS.map((vehicleSize) => (
              <option key={vehicleSize.value} value={vehicleSize.value}>
                {vehicleSize.label}
              </option>
            ))}
          </select>
        </div>

        <button type="submit">createParkingSpot()</button>
      </form>

      <p>Status: {status}</p>
    </section>
  );
}
