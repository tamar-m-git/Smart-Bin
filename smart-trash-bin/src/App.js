import React, { useEffect, useState } from "react";

function App() {
  const [imageUrl, setImageUrl] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState(null);

  const [fillbin, setFillbin] = useState(null);
  const [dryingStatus, setDryingStatus] = useState(null);

  // בקשת תמונה וחיזוי
  useEffect(() => {
    const serverUrl = "http://192.168.55.14:8888";

    const fetchData = async () => {
      try {
        setError(null);

        // תמונה
        const imageResponse = await fetch(`${serverUrl}/last-image?cacheBuster=${Date.now()}`);
        if (!imageResponse.ok) throw new Error("שגיאה בהבאת התמונה");
        const imageBlob = await imageResponse.blob();
        const imageObjectUrl = URL.createObjectURL(imageBlob);
        setImageUrl(imageObjectUrl);
        console.log("✅ Image updated");

        // חיזוי
        const predictionResponse = await fetch(`${serverUrl}/last-prediction`);
        if (!predictionResponse.ok) throw new Error("שגיאה בהבאת תוצאת החיזוי");
        const predictionData = await predictionResponse.json();
        setPrediction(predictionData.prediction || "לא התקבל חיזוי");
        console.log("✅ Prediction updated:", predictionData.prediction);
      } catch (err) {
        console.error("❌ Image/Prediction error:", err.message);
        setError(err.message);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 2000);
    return () => clearInterval(intervalId);
  }, []);

  // בקשת תכולת הפח
  useEffect(() => {
    const fetchFillbin = async () => {
      try {
        const res = await fetch("http://192.168.55.10/fillbin");
        if (!res.ok) throw new Error(`Error fetching fillbin: ${res.status}`);
        const text = await res.text();
        setFillbin(text);
        console.log("✅ Fillbin updated:", text);
      } catch (e) {
        console.error("❌ Fillbin error:", e.message);
        setFillbin(null);
      }
    };
    fetchFillbin();
    const intervalId = setInterval(fetchFillbin, 1000);
    return () => clearInterval(intervalId);
  }, []);

  // בקשת מצב ייבוש
  useEffect(() => {
    const fetchDryingStatus = async () => {
      try {
        const res = await fetch("http://192.168.55.10/dryingstatus");
        if (!res.ok) throw new Error(`Error fetching drying status: ${res.status}`);
        const text = await res.text();
        setDryingStatus(text === "1" ? "פּעיל" : "כבוי");
        console.log("✅ Drying status updated:", text);
      } catch (e) {
        console.error("❌ Drying status error:", e.message);
        setDryingStatus(null);
      }
    };
    fetchDryingStatus();
    const intervalId = setInterval(fetchDryingStatus, 1000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div style={styles.container}>
      <img
        src={`${process.env.PUBLIC_URL}/BIN1.png`}
        alt="לוגו BIN1"
        style={styles.logo}
      />

      {error && <p style={{ color: "red" }}>שגיאה: {error}</p>}

      <div style={styles.grid}>
        {/* תמונה */}
        <div style={styles.box}>
          <h3>📷 תמונה אחרונה</h3>
          {imageUrl ? (
            <img src={imageUrl} alt="תמונה אחרונה" style={styles.image} />
          ) : (
            <p>אין תמונה זמינה</p>
          )}
        </div>

        {/* חיזוי */}
        <div style={styles.box}>
          <h3>🔍 עצם מזוהה</h3>
          <p style={styles.valueText}>
            {prediction || "לא התקבל חיזוי"}
          </p>
        </div>

     {/* תכולת הפח */}
{false && (
  <div style={styles.box}>
    <h3>🗑️ תכולת הפח</h3>
    <p style={styles.valueText}>
      {fillbin !== null ? `${fillbin}%` : "טוען..."}
    </p>
  </div>
)}

        {/* ייבוש */}
        <div style={styles.box}>
          <h3>💨 ייבוש אוטומטי</h3>
          <p style={styles.valueText}>
            {dryingStatus !== null ? dryingStatus : "טוען..."}
          </p>
        </div>
      </div>
    </div>
  );
}

const boxSize = 200;

const styles = {
  container: {
    textAlign: "center",
    marginTop: 30,
    direction: "rtl",
    fontFamily: "'Rubik', sans-serif",
  },
  logo: {
    width: 400,
    height: "auto",
    marginBottom: 30,
  },
  grid: {
    display: "flex",
    justifyContent: "center",
    gap: 20,
    flexWrap: "wrap",
  },
  box: {
    width: boxSize,
    height: boxSize,
    border: "3px solid green",
    borderRadius: 12,
    padding: 10,
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
    boxShadow: "0 0 10px rgba(0,128,0,0.3)",
    backgroundColor: "#f0fff0",
  },
  image: {
    width: "100%",
    height: "100%",
    maxHeight: "120px",
    objectFit: "contain",
    borderRadius: 18,
  },
  valueText: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 10,
    color: "#333",
  },
};

export default App;
