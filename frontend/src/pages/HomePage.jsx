import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SpotMap } from "../components/map/SpotMap";
import { loadHomePageData } from "../services/homeService";
import { useContractConnection } from "../state/contractConnectionContext";
import { formatSpotStatus, shortenAddress } from "../utils/formatters";

const pageStyles = {
  page: {
    background:
      "radial-gradient(circle at top left, #dcfce7 0%, #f8fafc 42%, #ecfccb 100%)",
    minHeight: "100vh",
    padding: "24px"
  },
  shell: {
    display: "grid",
    gap: "20px",
    margin: "0 auto",
    maxWidth: "1440px"
  },
  nav: {
    alignItems: "center",
    background: "rgba(255, 255, 255, 0.88)",
    backdropFilter: "blur(14px)",
    border: "1px solid rgba(34, 197, 94, 0.16)",
    borderRadius: "24px",
    boxShadow: "0 20px 45px rgba(21, 128, 61, 0.08)",
    display: "grid",
    gap: "16px",
    gridTemplateColumns: "1.1fr 2fr auto auto auto",
    padding: "18px 22px"
  },
  logo: {
    color: "#14532d",
    fontFamily: "Georgia, serif",
    fontSize: "1.8rem",
    fontWeight: 700,
    margin: 0
  },
  search: {
    background: "#f8fafc",
    border: "1px solid #d1fae5",
    borderRadius: "999px",
    padding: "14px 18px"
  },
  navButton: {
    background: "#ffffff",
    border: "1px solid #d1fae5",
    borderRadius: "999px",
    color: "#166534",
    cursor: "pointer",
    fontWeight: 600,
    padding: "12px 18px",
    textDecoration: "none"
  },
  walletButton: {
    background: "#166534",
    border: "none",
    borderRadius: "999px",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 700,
    padding: "12px 18px"
  },
  hero: {
    display: "grid",
    gap: "20px",
    gridTemplateColumns: "2fr 1fr"
  },
  mapCard: {
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(240,253,244,0.96) 100%)",
    border: "1px solid rgba(34, 197, 94, 0.16)",
    borderRadius: "32px",
    boxShadow: "0 20px 45px rgba(21, 128, 61, 0.08)",
    overflow: "hidden",
    position: "relative"
  },
  mapHeader: {
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
    padding: "20px 24px 0"
  },
  mapBoard: {
    height: "520px",
    margin: "20px",
    overflow: "hidden",
    position: "relative",
    borderRadius: "28px"
  },
  statsColumn: {
    display: "grid",
    gap: "20px"
  },
  card: {
    background: "rgba(255, 255, 255, 0.92)",
    border: "1px solid rgba(34, 197, 94, 0.16)",
    borderRadius: "28px",
    boxShadow: "0 20px 45px rgba(21, 128, 61, 0.08)",
    padding: "22px"
  },
  metrics: {
    display: "grid",
    gap: "14px",
    gridTemplateColumns: "repeat(3, 1fr)"
  },
  drawer: {
    background: "#ffffff",
    borderTop: "1px solid rgba(34, 197, 94, 0.14)",
    display: "grid",
    gap: "18px",
    gridTemplateColumns: "2fr 1fr 1fr auto",
    padding: "22px 24px"
  },
  drawerButton: {
    background: "#166534",
    border: "none",
    borderRadius: "18px",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 700,
    padding: "14px 18px"
  },
  muted: {
    color: "#475569",
    margin: 0
  },
  sectionTitle: {
    color: "#14532d",
    fontFamily: "Georgia, serif",
    fontSize: "1.4rem",
    margin: "0 0 12px"
  },
  sessionList: {
    display: "grid",
    gap: "14px"
  },
  sessionCard: {
    background: "#f8fafc",
    border: "1px solid #dcfce7",
    borderRadius: "20px",
    padding: "16px"
  },
  featuredList: {
    display: "grid",
    gap: "12px",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
  },
  featuredCard: {
    background: "#ffffff",
    border: "1px solid #dcfce7",
    borderRadius: "20px",
    padding: "16px"
  }
};

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
          if (!selectedSpotId && nextData.spots[0]) {
            setSelectedSpotId(nextData.spots[0].id);
          }
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
    return homeData.spots.filter((spot) =>
      (spot.locationName || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [homeData.spots, searchTerm]);

  const selectedSpot =
    visibleSpots.find((spot) => spot.id === selectedSpotId) || visibleSpots[0] || null;

  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.shell}>
        <section style={pageStyles.nav}>
          <h2 style={pageStyles.logo}>ParkFi</h2>

          <input
            aria-label="Search parking spots"
            placeholder="Search by location"
            style={pageStyles.search}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          <Link style={pageStyles.navButton} to="/tests/createSpot">
            Add Spot
          </Link>

          <button style={pageStyles.navButton} type="button">
            Profile
          </button>

          <button style={pageStyles.walletButton} type="button" onClick={connect}>
            {account ? shortenAddress(account) : "Connect Wallet"}
          </button>
        </section>

        <section style={pageStyles.hero}>
          <div style={pageStyles.mapCard}>
            <div style={pageStyles.mapHeader}>
              <div>
                <p style={pageStyles.muted}>Map-first parking marketplace</p>
                <h3 style={pageStyles.sectionTitle}>Live spot availability</h3>
              </div>
              <p style={pageStyles.muted}>
                {isLoading ? "Refreshing map..." : `${visibleSpots.length} markers visible`}
              </p>
            </div>

            <div style={pageStyles.mapBoard}>
              <SpotMap
                selectedSpot={selectedSpot}
                spots={visibleSpots}
                onSelectSpot={setSelectedSpotId}
              />
            </div>

            {selectedSpot ? (
              <div style={pageStyles.drawer}>
                <div>
                  <p style={pageStyles.muted}>Selected Spot</p>
                  <h3 style={pageStyles.sectionTitle}>{selectedSpot.locationName}</h3>
                  <p style={pageStyles.muted}>{selectedSpot.description || "No description yet."}</p>
                </div>

                <div>
                  <p style={pageStyles.muted}>Owner</p>
                  <strong>{shortenAddress(selectedSpot.owner)}</strong>
                </div>

                <div>
                  <p style={pageStyles.muted}>Status</p>
                  <strong>{formatSpotStatus(selectedSpot.status)}</strong>
                  <p style={pageStyles.muted}>{selectedSpot.displayPrice}</p>
                </div>

                <button
                  style={pageStyles.drawerButton}
                  type="button"
                  onClick={() => console.log("Book Spot clicked", selectedSpot)}
                >
                  Book Spot
                </button>
              </div>
            ) : null}
          </div>

          <div style={pageStyles.statsColumn}>
            <section style={pageStyles.card}>
              <p style={pageStyles.muted}>Session overview</p>
              <div style={pageStyles.metrics}>
                <div>
                  <p style={pageStyles.muted}>Available</p>
                  <strong>{homeData.metrics.availableSpots}</strong>
                </div>
                <div>
                  <p style={pageStyles.muted}>Owned</p>
                  <strong>{homeData.metrics.ownedSpots}</strong>
                </div>
                <div>
                  <p style={pageStyles.muted}>Active rentals</p>
                  <strong>{homeData.metrics.activeSessions}</strong>
                </div>
              </div>
            </section>

            <section style={pageStyles.card}>
              <p style={pageStyles.muted}>Active Parking Sessions</p>
              <h3 style={pageStyles.sectionTitle}>Your current rights</h3>
              <div style={pageStyles.sessionList}>
                {homeData.activeSessions.length ? (
                  homeData.activeSessions.map((session) => (
                    <article key={session.id} style={pageStyles.sessionCard}>
                      <strong>{session.locationName}</strong>
                      <p style={pageStyles.muted}>Owner: {shortenAddress(session.owner)}</p>
                      <p style={pageStyles.muted}>{session.expiresLabel}</p>
                    </article>
                  ))
                ) : (
                  <p style={pageStyles.muted}>
                    {status === "Connected"
                      ? "No active parking sessions right now."
                      : "Connect your wallet to see active sessions."}
                  </p>
                )}
              </div>
            </section>
          </div>
        </section>

        <section style={pageStyles.card}>
          <p style={pageStyles.muted}>Marketplace snapshot</p>
          <h3 style={pageStyles.sectionTitle}>Featured active spots</h3>
          <div style={pageStyles.featuredList}>
            {homeData.featuredSpots.length ? (
              homeData.featuredSpots.map((spot) => (
                <article key={spot.id.toString()} style={pageStyles.featuredCard}>
                  <strong>{spot.locationName}</strong>
                  <p style={pageStyles.muted}>{spot.description || "Open parking listing"}</p>
                  <p style={pageStyles.muted}>Capacity: {spot.capacity.toString()}</p>
                </article>
              ))
            ) : (
              <p style={pageStyles.muted}>No active spots yet. Add the first one.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
