export const VEHICLE_SIZE_OPTIONS = [
  { label: "Motorcycle", value: "1" },
  { label: "Car", value: "2" },
  { label: "Van", value: "3" },
  { label: "Bus", value: "4" },
  { label: "Truck", value: "5" }
];

export function getVehicleSizeLabel(value) {
  const normalizedValue = value?.toString();
  const option = VEHICLE_SIZE_OPTIONS.find(
    (vehicleSize) => vehicleSize.value === normalizedValue
  );

  return option?.label || "-";
}
