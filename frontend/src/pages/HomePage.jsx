import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SpotMap } from "../components/map/SpotMap";
import { loadHomePageData } from "../services/homeService";
import { useContractConnection } from "../state/contractConnectionContext";
import { formatSpotStatus, shortenAddress } from "../utils/formatters";

export function HomePage() {
  const { account, connect, contracts, status } = useContractConnection();
  const [homeData, setHomeData] = useState({
    activeSessions: [],
    featuredSpots: [],
    metrics: {
      activeSessions: 0,
      availableSpots: 0,
      ownedSpots: 0
    },
    spots: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSpotListOpen, setIsSpotListOpen] = useState(false);
  const [selectedSpotId, setSelectedSpotId] = useState(null);

  useEffect(() => {
    if (!contracts) {
      return;
    }

    let active = true;

    const load = async () => {
      setIsLoading(true);

      try {
        const nextData = await loadHomePageData(contracts, account);

        if (active) {
          setHomeData(nextData);
        }
      } catch (error) {
        console.error("Failed to load home page data", error);
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
  }, [account, contracts]);

  const visibleSpots = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return homeData.spots;
    }

    return homeData.spots.filter((spot) =>
      (spot.locationName || "").toLowerCase().includes(normalizedSearch)
    );
  }, [homeData.spots, searchTerm]);

  const selectedSpot =
    visibleSpots.find((spot) => spot.id === selectedSpotId) || null;
  const hasSelection = Boolean(selectedSpot);

  useEffect(() => {
    if (selectedSpotId && !selectedSpot) {
      setSelectedSpotId(null);
    }
  }, [selectedSpot, selectedSpotId]);

  return (
    <div className="map-page">
      <header className="topbar">
        <Link className="brand" to="/">
          ParkFi
        </Link>

        <input
          aria-label="Search parking spots"
          className="search-input"
          placeholder="Search parking spots"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />

        <Link className="button-secondary" to="/add-spot">
          Add Spot
        </Link>

        <Link className="button-ghost" to="/profile">
          Profile
        </Link>

        <button className="button" type="button" onClick={connect}>
          {account ? shortenAddress(account) : "Connect Wallet"}
        </button>
      </header>

      <section className={`map-workspace${isSpotListOpen ? " has-left-panel" : ""}`}>
        <div className="map-surface">
          <SpotMap
            selectedSpot={selectedSpot}
            spots={visibleSpots}
            onEmptyClick={() => setSelectedSpotId(null)}
            onSelectSpot={setSelectedSpotId}
          />
          
          <button
            className={`spot-list-rail${isSpotListOpen ? " is-active" : ""}`}
            type="button"
            onClick={() => setIsSpotListOpen((current) => !current)}
          >
            <span>{visibleSpots.length}</span>
            Spots
          </button>
        </div>

        {isSpotListOpen ? (
          <aside className="left-panel">
            <p className="eyebrow">Nearby parking</p>
            <h1 className="panel-title">Choose a spot</h1>
            <p className="muted">
              {status === "Connected"
                ? `${homeData.metrics.availableSpots} available spots`
                : "Connect your wallet to load live spot data."}
            </p>

            <div className="detail-list">
              <div className="detail-row">
                <span className="muted">Owned</span>
                <strong>{homeData.metrics.ownedSpots}</strong>
              </div>
              <div className="detail-row">
                <span className="muted">Active rentals</span>
                <strong>{homeData.metrics.activeSessions}</strong>
              </div>
            </div>

            <div className="spot-list">
              {visibleSpots.length ? (
                visibleSpots.map((spot) => (
                  <button
                    className={`spot-list-button${selectedSpot?.id === spot.id ? " is-active" : ""
                      }`}
                    key={spot.id.toString()}
                    type="button"
                    onClick={() => setSelectedSpotId(spot.id)}
                  >
                    <strong>{spot.locationName}</strong>
                    <span className="muted">{spot.displayPrice}</span>
                  </button>
                ))
              ) : (
                <p className="notice">
                  {isLoading ? "Loading spots..." : "No spots match this search."}
                </p>
              )}
            </div>
          </aside>
        ) : null}

        {hasSelection ? (
          <>
            <aside className="info-panel">
              <button
                aria-label="Close selected spot"
                className="panel-close"
                type="button"
                onClick={() => setSelectedSpotId(null)}
              >
                X
              </button>

              <div>
                <p className="eyebrow">Selected spot</p>
                <h2 className="panel-title">{selectedSpot.locationName}</h2>
                <p className="muted">
                  {selectedSpot.description || "No description has been added yet."}
                </p>
              </div>

              <div className="detail-list">
                <div className="detail-row">
                  <span className="muted">Status</span>
                  <strong>{formatSpotStatus(selectedSpot.status)}</strong>
                </div>
                <div className="detail-row">
                  <span className="muted">Owner</span>
                  <strong>{shortenAddress(selectedSpot.owner)}</strong>
                </div>
                <div className="detail-row">
                  <span className="muted">Capacity</span>
                  <strong>{selectedSpot.capacity.toString()}</strong>
                </div>
                <div className="detail-row">
                  <span className="muted">Coordinates</span>
                  <strong>
                    {selectedSpot.latitude.toFixed(5)}, {selectedSpot.longitude.toFixed(5)}
                  </strong>
                </div>
              </div>

            </aside>

            <footer className="booking-bar">
              <div className="price-lockup">
                <span className="muted">Price per hour</span>
                <strong>{selectedSpot.displayPrice}</strong>
              </div>

              <Link className="button" to={`/booking/${selectedSpot.id.toString()}`}>
                Buy Parking
              </Link>
            </footer>
          </>
        ) : null}
      </section>
    </div>
  );
}
