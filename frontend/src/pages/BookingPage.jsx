import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { WalletButton } from "../components/shared/WalletButton";
import { getBooking, getSpotBookings } from "../services/bookingManagerReadService";
import { bookSpot } from "../services/bookingManagerWriteService";
import { getParkingSpot } from "../services/parkingRegistryReadService";
import { useContractConnection } from "../state/contractConnectionContext";
import { formatEthAmount, formatPricePerHour, shortenAddress } from "../utils/formatters";
import { getVehicleSizeLabel } from "../utils/vehicleSizes";

const SLOT_SECONDS = 15 * 60;
const SLOTS_PER_DAY = 96;
const MAX_BOOKING_YEAR_OFFSET = 20;
const VISIBLE_DAYS = 7;
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, monthIndex) => ({
  label: new Date(2026, monthIndex, 1).toLocaleDateString(undefined, {
    month: "long"
  }),
  value: monthIndex
}));

function normalizeSpot(rawSpot) {
  const pricePerHour = rawSpot.pricePerHour ?? rawSpot[6];

  return {
    description: rawSpot.description ?? rawSpot[3],
    displayPrice: formatPricePerHour(pricePerHour),
    id: rawSpot.id ?? rawSpot[0],
    isAvailable: rawSpot.isAvailable ?? rawSpot[7],
    locationName: rawSpot.locationName ?? rawSpot[2],
    owner: rawSpot.owner ?? rawSpot[1],
    pricePerHour,
    vehicleSize: rawSpot.vehicleSize ?? rawSpot[8]
  };
}

function normalizeBooking(rawBooking) {
  return {
    endTime: Number(rawBooking.endTime ?? rawBooking[5]),
    id: rawBooking.id ?? rawBooking[0],
    startTime: Number(rawBooking.startTime ?? rawBooking[4]),
    status: Number(rawBooking.status ?? rawBooking[8])
  };
}

function getBookingErrorMessage(error) {
  const reason = error?.reason || error?.revert?.args?.[0] || error?.shortMessage;

  if (reason) {
    return reason;
  }

  return "Booking failed. Please check the selected time and try again.";
}

function getStartOfLocalDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
}

function formatDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function getDayOptions(weekStartDate) {
  const today = getStartOfLocalDay(new Date());

  return Array.from({ length: VISIBLE_DAYS }, (_, index) => {
    const date = new Date(weekStartDate);
    date.setDate(weekStartDate.getDate() + index);
    const isToday = date.getTime() === today.getTime();

    return {
      date,
      isPast: date < today,
      key: formatDateKey(date),
      label: isToday
        ? "Today"
        : date.toLocaleDateString(undefined, { weekday: "short" }),
      longLabel: date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
      }),
      sublabel: date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short"
      })
    };
  });
}

function getSlotTimeLabel(slotIndex) {
  const totalMinutes = slotIndex * 15;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

function getSlotStartSeconds(dayDate, slotIndex) {
  return Math.floor(dayDate.getTime() / 1000) + slotIndex * SLOT_SECONDS;
}

function getSlotEndSeconds(dayDate, slotIndex) {
  return getSlotStartSeconds(dayDate, slotIndex) + SLOT_SECONDS;
}

function isBlockingBooking(booking, nowSeconds) {
  return (
    booking.status === 0 ||
    booking.status === 1 ||
    (booking.status === 2 && nowSeconds < booking.endTime)
  );
}

function isSlotOccupied(slotStart, slotEnd, bookings, nowSeconds) {
  return bookings.some((booking) => (
    isBlockingBooking(booking, nowSeconds) &&
    slotStart < booking.endTime &&
    slotEnd > booking.startTime
  ));
}

function hasBlockedSlot(startSlot, endSlot, slotStates) {
  return slotStates
    .slice(startSlot, endSlot)
    .some((slot) => slot.isPast || slot.isOccupied);
}

function findFirstAvailableSlot(slotStates) {
  const index = slotStates.findIndex((slot) => !slot.isPast && !slot.isOccupied);

  return index >= 0 ? index : 0;
}

function calculateProratedPrice(pricePerHour, startTime, endTime) {
  if (!pricePerHour || endTime <= startTime) {
    return 0n;
  }

  return (BigInt(pricePerHour) * BigInt(endTime - startTime)) / 3600n;
}

function getValidatedYear(value) {
  const year = Number(value);
  const currentYear = new Date().getFullYear();
  const maxYear = currentYear + MAX_BOOKING_YEAR_OFFSET;

  if (!Number.isInteger(year) || year < currentYear || year > maxYear) {
    return null;
  }

  return year;
}

function getFirstSelectableDayIndex(days) {
  const dayIndex = days.findIndex((day) => !day.isPast);

  return dayIndex >= 0 ? dayIndex : 0;
}

function getMonthStartDate(year, month) {
  const today = getStartOfLocalDay(new Date());
  const monthStart = new Date(year, month, 1);

  if (year === today.getFullYear() && month === today.getMonth()) {
    return today;
  }

  return monthStart;
}

export function BookingPage() {
  const navigate = useNavigate();
  const { spotId } = useParams();
  const { account, connect, contracts } = useContractConnection();
  const [spot, setSpot] = useState(null);
  const [bookings, setBookings] = useState([]);
  const currentDate = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [yearInput, setYearInput] = useState(String(currentDate.getFullYear()));
  const [weekStartDate, setWeekStartDate] = useState(() => getStartOfLocalDay(new Date()));
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [selectedStartSlot, setSelectedStartSlot] = useState(0);
  const [selectedEndSlot, setSelectedEndSlot] = useState(1);
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState(null);

  const selectedYear = getValidatedYear(yearInput);
  const currentYear = currentDate.getFullYear();
  const maxBookingYear = currentYear + MAX_BOOKING_YEAR_OFFSET;
  const yearError = selectedYear
    ? null
    : `Enter a year from ${currentYear} to ${maxBookingYear}.`;
  const dayOptions = useMemo(
    () => selectedYear ? getDayOptions(weekStartDate) : [],
    [selectedYear, weekStartDate]
  );
  const selectedDay = dayOptions[selectedDayIndex] || dayOptions[0] || {
    date: getStartOfLocalDay(new Date()),
    isPast: false,
    key: "fallback",
    label: "Today",
    longLabel: "-",
    sublabel: "-"
  };

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
          setBookings(nextBookings.map((booking) => normalizeBooking(booking)));
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

  useEffect(() => {
    if (selectedYear === currentYear && selectedMonth < currentDate.getMonth()) {
      setSelectedMonth(currentDate.getMonth());
      setWeekStartDate(getStartOfLocalDay(currentDate));
      setSelectedDayIndex(0);
    }
  }, [currentDate, currentYear, selectedMonth, selectedYear]);

  useEffect(() => {
    setSelectedMonth(weekStartDate.getMonth());
    setYearInput(String(weekStartDate.getFullYear()));
  }, [weekStartDate]);

  const nowSeconds = Math.floor(Date.now() / 1000);

  const slotStates = useMemo(
    () => Array.from({ length: SLOTS_PER_DAY }, (_, slotIndex) => {
      const slotStart = getSlotStartSeconds(selectedDay.date, slotIndex);
      const slotEnd = getSlotEndSeconds(selectedDay.date, slotIndex);

      return {
        isOccupied: isSlotOccupied(slotStart, slotEnd, bookings, nowSeconds),
        isPast: slotStart < nowSeconds,
        label: getSlotTimeLabel(slotIndex),
        slotEnd,
        slotIndex,
        slotStart
      };
    }),
    [bookings, nowSeconds, selectedDay.date]
  );

  useEffect(() => {
    if (!dayOptions.length) {
      return;
    }

    const selectedDayOption = dayOptions[selectedDayIndex];

    if (!selectedDayOption || selectedDayOption.isPast) {
      setSelectedDayIndex(getFirstSelectableDayIndex(dayOptions));
      return;
    }

    const currentRangeBlocked =
      selectedEndSlot <= selectedStartSlot ||
      hasBlockedSlot(selectedStartSlot, selectedEndSlot, slotStates);

    if (!currentRangeBlocked) {
      return;
    }

    const firstAvailableSlot = findFirstAvailableSlot(slotStates);
    setSelectedStartSlot(firstAvailableSlot);
    setSelectedEndSlot(Math.min(firstAvailableSlot + 1, SLOTS_PER_DAY));
  }, [dayOptions, selectedDayIndex, selectedEndSlot, selectedStartSlot, slotStates]);

  const selectedStartTime = getSlotStartSeconds(selectedDay.date, selectedStartSlot);
  const selectedEndTime = getSlotStartSeconds(selectedDay.date, selectedEndSlot);
  const selectedRangeLabel = `${getSlotTimeLabel(selectedStartSlot)} - ${getSlotTimeLabel(selectedEndSlot)}`;
  const selectedMinutes = Math.max(0, (selectedEndSlot - selectedStartSlot) * 15);

  const totalPrice = useMemo(
    () => calculateProratedPrice(spot?.pricePerHour, selectedStartTime, selectedEndTime),
    [selectedEndTime, selectedStartTime, spot?.pricePerHour]
  );

  const selectDay = (dayIndex) => {
    if (dayOptions[dayIndex]?.isPast) {
      return;
    }

    setSelectedDayIndex(dayIndex);
    setError(null);
  };

  const changeMonth = (event) => {
    const nextMonth = Number(event.target.value);
    const nextYear = selectedYear || currentYear;

    setSelectedMonth(nextMonth);
    setWeekStartDate(getMonthStartDate(nextYear, nextMonth));
    setSelectedDayIndex(0);
    setError(null);
  };

  const changeYear = (event) => {
    const nextValue = event.target.value.replace(/\D/g, "").slice(0, 4);
    const nextYear = getValidatedYear(nextValue);

    setYearInput(nextValue);

    if (nextYear) {
      setWeekStartDate(getMonthStartDate(nextYear, selectedMonth));
    }

    setSelectedDayIndex(0);
    setError(null);
  };

  const shiftWeek = (direction) => {
    const today = getStartOfLocalDay(currentDate);
    const nextDate = new Date(weekStartDate);
    nextDate.setDate(weekStartDate.getDate() + direction * VISIBLE_DAYS);

    const clampedDate = nextDate < today ? today : nextDate;
    setWeekStartDate(clampedDate);
    setSelectedDayIndex(0);
    setError(null);
  };

  const selectSlot = (slotIndex) => {
    const slot = slotStates[slotIndex];

    if (!slot || slot.isPast || slot.isOccupied) {
      return;
    }

    setError(null);

    if (slotIndex <= selectedStartSlot || selectedEndSlot > selectedStartSlot + 1) {
      setSelectedStartSlot(slotIndex);
      setSelectedEndSlot(Math.min(slotIndex + 1, SLOTS_PER_DAY));
      return;
    }

    const nextEndSlot = Math.min(slotIndex + 1, SLOTS_PER_DAY);

    if (hasBlockedSlot(selectedStartSlot, nextEndSlot, slotStates)) {
      setError(new Error("Selected range crosses unavailable time."));
      return;
    }

    setSelectedEndSlot(nextEndSlot);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError(null);

    if (!contracts || !spot) {
      setStatus("Connect wallet first");
      return;
    }

    if (!selectedYear) {
      setError(new Error(yearError));
      return;
    }

    if (hasBlockedSlot(selectedStartSlot, selectedEndSlot, slotStates)) {
      setError(new Error("Selected range is unavailable."));
      return;
    }

    setStatus("Submitting...");

    try {
      await bookSpot(contracts.bookingManager, {
        endTime: selectedEndTime,
        spotId: spot.id,
        startTime: selectedStartTime,
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
        <WalletButton account={account} connect={connect} />
      </header>

      <main className="content-page">
        <div className="content-shell">
          <div>
            <p className="eyebrow">Booking</p>
            <h1 className="page-title">{spot?.locationName || "Parking spot"}</h1>
            <p className="muted">
              {spot?.description || "Choose your day and select a time range."}
            </p>
          </div>

          <section className="form-grid">
            <form className="form-panel" onSubmit={submit}>
              <div className="calendar-toolbar">
                <div>
                  <p className="eyebrow">Calendar</p>
                  <h2 className="panel-title">Choose date</h2>
                </div>
                <div className="calendar-controls">
                  <div className="week-nav">
                    <button
                      aria-label="Previous week"
                      className="icon-button"
                      type="button"
                      onClick={() => shiftWeek(-1)}
                    >
                      {"<"}
                    </button>
                    <button
                      aria-label="Next week"
                      className="icon-button"
                      type="button"
                      onClick={() => shiftWeek(1)}
                    >
                      {">"}
                    </button>
                  </div>
                  <select
                    aria-label="Booking month"
                    className="form-select"
                    value={selectedMonth}
                    onChange={changeMonth}
                  >
                    {MONTH_OPTIONS.map((month) => (
                      <option
                        disabled={selectedYear === currentYear && month.value < currentDate.getMonth()}
                        key={month.value}
                        value={month.value}
                      >
                        {month.label}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Booking year"
                    className={`form-input${yearError ? " is-invalid" : ""}`}
                    inputMode="numeric"
                    maxLength="4"
                    value={yearInput}
                    onChange={changeYear}
                  />
                </div>
              </div>
              {yearError ? <p className="notice">{yearError}</p> : null}

              <div className="booking-calendar">
                {dayOptions.map((day, index) => (
                  <button
                    className={`day-button${selectedDayIndex === index ? " is-active" : ""}`}
                    disabled={day.isPast}
                    key={day.key}
                    type="button"
                    onClick={() => selectDay(index)}
                  >
                    <span>{day.label}</span>
                    <strong>{day.sublabel}</strong>
                  </button>
                ))}
              </div>

              <div className="booking-timeline">
                <div className="timeline-labels">
                  <span>00:00</span>
                  <span>06:00</span>
                  <span>12:00</span>
                  <span>18:00</span>
                  <span>24:00</span>
                </div>
                <div className="timeline-grid">
                  {slotStates.map((slot) => {
                    const isSelected =
                      slot.slotIndex >= selectedStartSlot &&
                      slot.slotIndex < selectedEndSlot;
                    const className = [
                      "timeline-slot",
                      slot.isPast ? "is-past" : "",
                      slot.isOccupied ? "is-occupied" : "",
                      isSelected ? "is-selected" : ""
                    ].filter(Boolean).join(" ");

                    return (
                      <button
                        aria-label={`${slot.label} slot`}
                        className={className}
                        disabled={slot.isPast || slot.isOccupied}
                        key={slot.slotIndex}
                        title={`${slot.label}${slot.isOccupied ? " unavailable" : ""}`}
                        type="button"
                        onClick={() => selectSlot(slot.slotIndex)}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="booking-range-summary">
                <div>
                  <span className="muted">Selected time</span>
                  <strong>{selectedRangeLabel}</strong>
                </div>
                <div>
                  <span className="muted">Duration</span>
                  <strong>{selectedMinutes} min</strong>
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
                  <span className="muted">Date</span>
                  <strong>{selectedDay.longLabel}</strong>
                </div>
                <div className="detail-row">
                  <span className="muted">Time</span>
                  <strong>{selectedRangeLabel}</strong>
                </div>
                <div className="detail-row">
                  <span className="muted">Total</span>
                  <strong>{formatEthAmount(totalPrice)}</strong>
                </div>
                <div className="detail-row">
                  <span className="muted">Owner</span>
                  <strong>{shortenAddress(spot?.owner)}</strong>
                </div>
                <div className="detail-row">
                  <span className="muted">Vehicle type</span>
                  <strong>{getVehicleSizeLabel(spot?.vehicleSize)}</strong>
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
