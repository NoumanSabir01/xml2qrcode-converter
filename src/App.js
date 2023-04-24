import React, { useState } from "react";
import QRCode from "qrcode";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import "./App.css";

pdfMake.vfs = pdfFonts.pdfMake.vfs;

const App = () => {
  const [qrCodes, setQrCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [xmlData, setXmlData] = useState("");

  const generateQrCodes = async () => {
    setLoading(true);

    const sets = xmlData.match(/<set[^>]*>(.*?)<\/set>/gs);

    if (!sets) {
      setLoading(false);
      return;
    }
    const qrCodeData = sets
      .map((set) => {
        const setIdMatch = set.match(/SetNumber="(.*?)"/);
        const imp = set.match(/IMP="(.*?)"/);
        const setId = setIdMatch && setIdMatch[1];

        const blockMatch = set.match(/<Block\d+\s+[^>]*>/g);

        const blockData = blockMatch
          .map((block) => {
            const blockValues = block.match(/RG="(.*?)"/);
            const rg = blockValues && blockValues[1];
            const agMatch = block.match(/AG="(.*?)"/);
            const ag = agMatch && agMatch[1];

            const paddedRg =
              rg && (parseInt(rg.split(",")[0]) < 10 ? `0${rg}` : rg);
            const paddedAg = ag && (parseInt(ag) < 10 ? `0${ag}` : ag);
            return `${paddedRg}${paddedAg}`;
          })
          .join("");

        return (
          setId &&
          `LOT21:WMD1JC${imp[1] === "True" ? "MYS" : "MNS"}${blockData}\n`
        );
      })
      .filter((data) => data);

    const qrCodes = [];
    let currentQrCode = "";
    for (let i = 0; i < qrCodeData.length; i++) {
      currentQrCode += qrCodeData[i];
      if ((i + 1) % 10 === 0 || i === qrCodeData.length - 1) {
        const qrCodeImage = await QRCode.toDataURL(
          currentQrCode.replace(/,/g, "").replace(/http:/g, ""),
          { noSymbol: true }
        );
        qrCodes.push(qrCodeImage);
        currentQrCode = "";
      }
    }

    setLoading(false);
    setQrCodes(qrCodes);
  };

  const generatePdf = () => {
    const docDefinition = {
      content: qrCodes.map((qrCodeData) => ({
        image: qrCodeData,
        width: 200,
        alignment: "center",
        pageBreak: "after",
      })),
    };
    pdfMake.createPdf(docDefinition).open();
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const fileContents = reader.result;
      setXmlData(fileContents);
    };
    reader.readAsText(file);
  };

  return (
    <div class="container">
      <h1>XML to QrCode Converter</h1>
      <label class="upload">
        Upload XML file
        <input
          type="file"
          accept=".xml"
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />
      </label>
      <button
        class="generate-qrcodes"
        onClick={generateQrCodes}
        disabled={!xmlData || loading}
      >
        <span class="generate-qrcodes-text">
          {loading ? "Generating..." : "Generate QR Codes"}
        </span>
      </button>
      <button
        class="generate-pdf"
        onClick={generatePdf}
        disabled={!qrCodes.length}
      >
        Generate PDF
      </button>
      {loading && <p class="loading">Generating QR codes, please wait...</p>}
      {qrCodes.length > 0 && (
        <div class="qrcodes-container">
          {qrCodes.map((qrCode, index) => (
            <img
              key={index}
              src={qrCode}
              alt={`QR code ${index}`}
              class="qrcode"
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
