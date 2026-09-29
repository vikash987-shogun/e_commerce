import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import "./index.css";

// Fix generic Leaflet icon missing in webpack/vite environments
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import iconRetina from "leaflet/dist/images/marker-icon-2x.png";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconRetinaUrl: iconRetina,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

declare global {
  namespace L {
    namespace Routing {
      function control(options: any): any;
      function osrmv1(options: any): any;
    }
  }
}

interface Store {
  name: string;
  price: number;
  rating: number;
  offer: string;
  lat: number;
  lng: number;
  distance?: number;
}

interface Result {
  product: string;
  stores: Store[];
  concepts?: string[];
}

function MapController({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

function MapEvents({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationSource, setLocationSource] = useState<"GPS" | "Fallback" | "Detecting" | "Manual">("Detecting");

  const [distance, setDistance] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  const mapRef = useRef<L.Map | null>(null);
  const routingRef = useRef<any>(null);

  // -------------------------
  // GET USER LOCATION
  // -------------------------
  const detectLocation = () => {
    setLocationSource("Detecting");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([
            position.coords.latitude,
            position.coords.longitude,
          ]);
          setLocationSource("GPS");
        },
        () => {
          console.warn("Geolocation failed, using fallback.");
          setUserLocation([11.00687, 77.08116]);
          setLocationSource("Fallback");
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setUserLocation([11.00687, 77.08116]);
      setLocationSource("Fallback");
    }
  };

  useEffect(() => {
    detectLocation();
  }, []);

  // -------------------------
  // SEARCH
  // -------------------------
  const handleSearch = async () => {
    if (!searchQuery || !userLocation) return;

    try {
      const response = await axios.get(
        "http://localhost:5000/search",
        {
          params: {
            q: searchQuery,
            lat: userLocation[0],
            lng: userLocation[1],
          },
        }
      );

      setResult(response.data);
      setDistance(null);
      setDuration(null);

      if (routingRef.current && mapRef.current) {
        mapRef.current.removeControl(routingRef.current);
        routingRef.current = null;
      }
    } catch (error) {
      console.error("Search error:", error);
    }
  };

  // -------------------------
  // UPDATE USER LOCATION MANUALLY OR DYNAMICALLY
  // -------------------------
  const updateUserLocation = (lat: number, lng: number) => {
    setUserLocation([lat, lng]);
    setLocationSource("Manual");
    
    // Update active route if it exists
    if (routingRef.current && mapRef.current) {
      const waypoints = routingRef.current.getWaypoints();
      if (waypoints && waypoints.length >= 2) {
        routingRef.current.setWaypoints([
          L.latLng(lat, lng),
          waypoints[1].latLng
        ]);
      }
    }

    // Refresh products if a product is currently searched
    if (result && result.product && result.product !== "Not found") {
      axios.get("http://localhost:5000/search", {
        params: {
          q: result.product,
          lat: lat,
          lng: lng,
        }
      }).then(response => {
        setResult(response.data);
      }).catch(err => {
        console.error("Failed to refresh search results", err);
      });
    }
  };

  // -------------------------
  // IMAGE UPLOAD
  // -------------------------
  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!e.target.files?.[0] || !userLocation) return;

    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        console.log("📤 Analyzing image with Puter...");
        const dataUrl = event.target?.result as string;
        
        // Ensure puter is available
        // @ts-ignore
        if (!window.puter) {
          alert("Puter.js is not loaded yet. Please refresh the page.");
          return;
        }
        
        // Puter AI Chat Call
        // @ts-ignore
        const aiResponse = await window.puter.ai.chat(
          "List the 5 most prominent objects or items in this image, separated by commas. Reply with only the comma-separated list and no other text.",
          dataUrl
        );

        let responseText = "";
        if (typeof aiResponse === "string") {
            responseText = aiResponse;
        } else if (aiResponse && aiResponse.message) {
            responseText = aiResponse.message.content;
        } else {
            responseText = String(aiResponse);
        }

        const tags = responseText
          .split(",")
          .map((tag: string) => tag.trim().toLowerCase())
          .filter((tag: string) => tag.length > 0);

        console.log("🧠 Puter identified tags:", tags);

        if (tags.length === 0) {
            alert("Could not identify objects in the image.");
            return;
        }

        console.log("📤 Sending tags to backend...");
        const response = await axios.post(
          "http://localhost:5000/search-tags",
          {
            tags,
            lat: userLocation[0],
            lng: userLocation[1]
          }
        );

        console.log(`✅ Upload response data:`, response.data);
        setResult(response.data);
      } catch (error: any) {
        console.error("Upload error:", error);
        alert("Image recognition failed. Please try again.");
      }
    };
    reader.onerror = () => {
      alert("Failed to read image file.");
    };

    reader.readAsDataURL(file);
  };

  // -------------------------
  // SHOW ROUTE
  // -------------------------
  const showRoute = (store: Store) => {
    if (!userLocation || !mapRef.current) return;

    if (!store.lat || !store.lng) {
      alert("Store location missing.");
      return;
    }

    if (routingRef.current) {
      mapRef.current.removeControl(routingRef.current);
    }

    const mapElement = document.getElementById("map-section");
    if (mapElement) {
      mapElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    const routingControl = (L as any).Routing.control({
      router: (L as any).Routing.osrmv1({
        serviceUrl: "https://router.project-osrm.org/route/v1",
      }),
      waypoints: [
        L.latLng(userLocation[0], userLocation[1]),
        L.latLng(store.lat, store.lng),
      ],
      routeWhileDragging: false,
      draggableWaypoints: false,
      addWaypoints: false,
      show: false,
      createMarker: () => null,
    })
      .on("routesfound", (e: any) => {
        const route = e.routes[0];
        const summary = route.summary;

        setDistance(summary.totalDistance / 1000);
        setDuration(summary.totalTime / 60);

        const bounds = L.latLngBounds(route.coordinates);
        mapRef.current?.fitBounds(bounds);
      })
      .addTo(mapRef.current);

    routingRef.current = routingControl;
  };
  
  // @ts-ignore
  window.testShowRoute = () => showRoute({ lat: 11.0168, lng: 77.0911, name: "Test Store", price: 100, rating: 5, offer: "None" });


  return (
    <div style={{ padding: "40px 20px", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
      <header style={{ textAlign: "center", marginBottom: "40px" }} className="animate-fade-in">
        <h1 className="gradient-text" style={{ fontSize: "3.5rem", fontWeight: 700, margin: "0 0 10px 0", letterSpacing: "-1px" }}>
          OptiPrice
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "1.2rem", margin: 0 }}>
          Find the best deals around you in real-time.
        </p>
      </header>

      <main>
        {/* SEARCH BAR GLASS PANEL */}
        <div 
          className="glass-panel animate-fade-in" 
          style={{ padding: "30px", marginBottom: "40px", display: "flex", flexWrap: "wrap", gap: "15px", justifyContent: "center", alignItems: "center" }}
        >
          <input
            type="text"
            placeholder="🔎 Search for a product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="modern-input"
            style={{ flex: "1", minWidth: "250px", maxWidth: "450px" }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} className="modern-button">
            Search
          </button>
          <div style={{ color: "var(--text-muted)", fontWeight: "bold", margin: "0 10px" }}>or</div>
          <label className="modern-button" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
            Upload Image
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
          </label>
        </div>

        {/* RESULTS SECTION */}
        {result && (
          <div className="animate-fade-in" style={{ animationDelay: "0.2s", opacity: 0, animationFillMode: "forwards" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "20px", borderBottom: "1px solid var(--border-color)", paddingBottom: "15px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <h2 style={{ fontSize: "1.8rem", fontWeight: 600, margin: 0 }}>
                  {result.product === "Not found" ? (
                    <span style={{ color: "var(--secondary)" }}>Product Not Found in Database</span>
                  ) : (
                    <>Results for <span className="gradient-text">"{result.product}"</span></>
                  )}
                </h2>
                {result.concepts && result.concepts.length > 0 && (
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    AI Perceived: <span style={{ color: "var(--primary)" }}>{result.concepts.join(", ")}</span>
                  </p>
                )}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: "1rem", background: "rgba(255,255,255,0.05)", padding: "4px 12px", borderRadius: "20px" }}>
                {result.stores.length} stores found
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "25px" }}>
              {[...result.stores].sort((a, b) => a.price - b.price).map((store, index) => {
                const isBest = index === 0;
                return (
                  <div key={index} className={`glass-card ${isBest ? "glass-card-best" : ""}`} style={{ padding: "25px", display: "flex", flexDirection: "column", gap: "15px", position: "relative" }}>
                    {isBest && (
                      <div style={{ position: "absolute", top: "-12px", right: "20px", background: "var(--success)", color: "white", padding: "4px 12px", borderRadius: "12px", fontSize: "0.85rem", fontWeight: "bold", boxShadow: "0 4px 10px rgba(16,185,129,0.3)" }}>
                        Top Pick 🏆
                      </div>
                    )}
                    <h3 style={{ fontSize: "1.4rem", margin: 0, color: "var(--text-main)" }}>{store.name}</h3>
                    
                    <div style={{ fontSize: "2.2rem", fontWeight: 700, margin: "5px 0", color: isBest ? "var(--success)" : "var(--primary)" }}>
                      ₹{store.price.toLocaleString()}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", color: "var(--text-muted)", fontSize: "0.95rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "1.2rem" }}>📍</span> 
                        {store.distance ? `${store.distance.toFixed(1)} km away` : "Calculating..."}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "1.2rem" }}>⭐</span> 
                        {store.rating} / 5.0 Rating
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--secondary)" }}>
                        <span style={{ fontSize: "1.2rem" }}>🎁</span> 
                        <span style={{ background: "rgba(236, 72, 153, 0.1)", padding: "2px 8px", borderRadius: "12px", color: "var(--secondary)", fontWeight: "bold" }}>{store.offer}</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => showRoute(store)} 
                      className={`modern-button ${isBest ? 'success' : ''}`}
                      style={{ marginTop: "10px", width: "100%", padding: "12px", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", fontWeight: "bold" }}
                    >
                      🗺️ Show Route
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MAP */}
        {userLocation && (
          <div id="map-section" className="glass-panel animate-fade-in" style={{ marginTop: "40px", padding: "25px", display: "flex", flexDirection: "column", gap: "20px", animationDelay: "0.4s", opacity: 0, animationFillMode: "forwards" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "15px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <h3 style={{ margin: 0, fontSize: "1.5rem", display: "flex", alignItems: "center", gap: "10px" }}>
                  🌍 Interactive Map
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                   <span style={{ 
                     fontSize: "0.8rem", 
                     padding: "2px 8px", 
                     borderRadius: "10px", 
                     background: 
                       locationSource === "GPS" ? "rgba(16, 185, 129, 0.2)" :
                       locationSource === "Manual" ? "rgba(139, 92, 246, 0.2)" :
                       "rgba(245, 158, 11, 0.2)",
                     color: 
                       locationSource === "GPS" ? "#10b981" :
                       locationSource === "Manual" ? "#8b5cf6" :
                       "#f59e0b",
                     fontWeight: "bold"
                   }}>
                     {locationSource === "GPS" ? "📍 Using Real Location" :
                      locationSource === "Manual" ? "🖐️ Custom Location Set" :
                      locationSource === "Detecting" ? "🔍 Detecting Location..." :
                      "⚠️ Location Fallback (Coimbatore)"}
                   </span>
                   <button 
                     onClick={detectLocation} 
                     style={{ background: "none", border: "none", color: "var(--primary)", fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline", padding: 0 }}
                   >
                     Refresh Location
                   </button>
                </div>
              </div>
              {distance && duration && (
                <div style={{ display: "flex", gap: "20px", background: "rgba(139, 92, 246, 0.15)", border: "1px solid rgba(139, 92, 246, 0.4)", padding: "10px 20px", borderRadius: "12px", color: "var(--primary)" }}>
                  <span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>🚗 {distance.toFixed(1)} km</span>
                  <span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>⏱️ {duration.toFixed(0)} mins</span>
                </div>
              )}
            </div>
            
            <div style={{ borderRadius: "16px", overflow: "hidden", border: "1px solid var(--border-color)", boxShadow: "0 10px 20px rgba(0,0,0,0.2)" }}>
              <MapContainer style={{ height: "450px", width: "100%" }} ref={mapRef} center={userLocation} zoom={13}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapController center={userLocation} />
                <MapEvents onMapClick={(lat, lng) => updateUserLocation(lat, lng)} />
                <Marker 
                  position={userLocation}
                  draggable={true}
                  eventHandlers={{
                    dragend: (e) => {
                      const marker = e.target;
                      const position = marker.getLatLng();
                      updateUserLocation(position.lat, position.lng);
                    }
                  }}
                >
                  <Popup>
                    <div style={{textAlign: "center", fontWeight: "bold", padding: "5px"}}>
                      📍 You are here<br/>
                      <span style={{ fontSize: "0.85rem", fontWeight: "normal", color: "#cbd5e1" }}>
                        (Drag me or click map to move)
                      </span>
                    </div>
                  </Popup>
                </Marker>
                {result?.stores.filter((s) => s.lat && s.lng).map((store, index) => (
                  <Marker key={index} position={[store.lat, store.lng]}>
                    <Popup>
                      <div style={{ textAlign: "center", minWidth: "100px" }}>
                        <strong style={{ display: "block", marginBottom: "6px", fontSize: "1.1rem" }}>{store.name}</strong>
                        <span style={{ color: "#10b981", fontWeight: "bold", fontSize: "1.2rem", background: "rgba(16,185,129,0.1)", padding: "2px 8px", borderRadius: "8px" }}>₹{store.price}</span>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;